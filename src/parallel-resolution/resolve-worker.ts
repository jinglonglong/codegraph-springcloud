/**
 * Resolve Worker
 *
 * Runs reference resolution in a separate thread. Each worker owns an
 * independent SQLite connection (WAL mode allows concurrent readers while the
 * main thread writes) and a ReferenceResolver instance. The worker resolves
 * batches of UnresolvedRefs sent by the main-thread pool and reports per-batch
 * progress so the pool can throttle aggregate progress updates.
 *
 * Protocol:
 *   init          -> init-done
 *   resolve-batch -> resolve-batch-result | resolve-batch-error
 *   progress      -> emitted spontaneously during resolve-batch
 *   shutdown      -> shutdown-ack
 *
 * Per-ref errors are isolated: a single malformed reference cannot abort the
 * whole batch. If the batch-level resolver throws, the worker falls back to
 * resolving refs one-by-one.
 */

import { parentPort, workerData } from 'worker_threads';
import { DatabaseConnection } from '../db';
import { QueryBuilder } from '../db/queries';
import { ReferenceResolver } from '../resolution';
import type { UnresolvedRef, ResolvedRef, ResolutionResult } from '../resolution/types';
import { logDebug } from '../errors';

interface ResolveWorkerInitData {
  projectRoot: string;
  dbPath: string;
  frameworkNames?: string[];
}

interface BatchResult {
  resolved: ResolvedRef[];
  unresolved: UnresolvedRef[];
  stats: ResolutionResult['stats'];
  deferredChainRefs: UnresolvedRef[];
  deferredThisMemberRefs: UnresolvedRef[];
  deferredSuperMemberRefs: UnresolvedRef[];
}

let db: DatabaseConnection | null = null;
let queries: QueryBuilder | null = null;
let resolver: ReferenceResolver | null = null;
let initData: ResolveWorkerInitData | null = null;

function getInitData(): ResolveWorkerInitData {
  if (initData) return initData;
  const raw = workerData as ResolveWorkerInitData | undefined;
  if (!raw || !raw.projectRoot || !raw.dbPath) {
    throw new Error('ResolveWorker: missing projectRoot or dbPath in workerData');
  }
  initData = raw;
  return raw;
}

function initialize(): void {
  if (resolver) return;

  const { projectRoot, dbPath } = getInitData();

  db = DatabaseConnection.open(dbPath);
  queries = new QueryBuilder(db.getDb());
  resolver = new ReferenceResolver(projectRoot, queries);
  resolver.initialize();
  resolver.warmCaches();
}

function close(): void {
  try {
    db?.close();
  } catch {
    // ignore
  }
  db = null;
  queries = null;
  resolver = null;
}

function sendDeferredArrays(): Omit<BatchResult, 'resolved' | 'unresolved' | 'stats'> {
  // Private arrays are the only place the resolver stores deferred refs.
  // Cast because adding getters would be a larger change than necessary.
  const r = resolver as unknown as {
    deferredChainRefs: UnresolvedRef[];
    deferredThisMemberRefs: UnresolvedRef[];
    deferredSuperMemberRefs: UnresolvedRef[];
  };
  const deferredChainRefs = r.deferredChainRefs.slice();
  const deferredThisMemberRefs = r.deferredThisMemberRefs.slice();
  const deferredSuperMemberRefs = r.deferredSuperMemberRefs.slice();
  // Reset so the next batch starts clean.
  r.deferredChainRefs = [];
  r.deferredThisMemberRefs = [];
  r.deferredSuperMemberRefs = [];
  return { deferredChainRefs, deferredThisMemberRefs, deferredSuperMemberRefs };
}

function resolveBatch(refs: UnresolvedRef[], batchId: number): BatchResult {
  initialize();

  // Fast path: use ReferenceResolver.resolveAll for the whole batch. It is
  // already optimized and emits 1% progress updates.
  try {
    const onProgress = (current: number, total: number) => {
      parentPort?.postMessage({ type: 'progress', batchId, current, total });
    };
    const result = resolver!.resolveAll(refs, onProgress);
    const deferred = sendDeferredArrays();
    return {
      resolved: result.resolved,
      unresolved: result.unresolved,
      stats: result.stats,
      ...deferred,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logDebug('ResolveWorker: batch resolver failed, falling back to per-ref resolution', {
      batchId,
      error: message,
    });
  }

  // Fallback: resolve refs individually so one bad ref cannot abort the batch.
  const resolved: ResolvedRef[] = [];
  const unresolved: UnresolvedRef[] = [];
  const byMethod: Record<string, number> = {};
  const resolveOne = (resolver as unknown as { resolveOne(ref: UnresolvedRef): ResolvedRef | null })
    .resolveOne;

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]!;
    try {
      const result = resolveOne.call(resolver, ref);
      if (result) {
        resolved.push(result);
        byMethod[result.resolvedBy] = (byMethod[result.resolvedBy] ?? 0) + 1;
      } else {
        unresolved.push(ref);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logDebug('ResolveWorker: per-ref resolution error', {
        batchId,
        fromNodeId: ref.fromNodeId,
        referenceName: ref.referenceName,
        error: message,
      });
      unresolved.push(ref);
    }

    if (i % 50 === 0) {
      parentPort?.postMessage({ type: 'progress', batchId, current: i + 1, total: refs.length });
    }
  }

  const deferred = sendDeferredArrays();
  return {
    resolved,
    unresolved,
    stats: {
      total: refs.length,
      resolved: resolved.length,
      unresolved: unresolved.length,
      byMethod,
    },
    ...deferred,
  };
}

if (!parentPort) {
  throw new Error('ResolveWorker must be run as a worker_threads worker');
}

parentPort.on(
  'message',
  (msg: { type: string; batchId?: number; refs?: UnresolvedRef[] }) => {
    if (msg.type === 'init') {
      initialize();
      parentPort!.postMessage({ type: 'init-done' });
      return;
    }

    if (msg.type === 'resolve-batch') {
      const batchId = msg.batchId ?? 0;
      try {
        const result = resolveBatch(msg.refs ?? [], batchId);
        parentPort!.postMessage({ type: 'resolve-batch-result', batchId, result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        parentPort!.postMessage({
          type: 'resolve-batch-error',
          batchId,
          error: message,
        });
      }
      return;
    }

    if (msg.type === 'shutdown') {
      close();
      parentPort!.postMessage({ type: 'shutdown-ack' });
      return;
    }
  }
);

// init-performance change: workers start on demand via the 'init' message, but
// if workerData is already present we can eagerly initialize so the first batch
// spends zero time loading frameworks.
try {
  getInitData();
} catch {
  // Will be initialized on first message.
}
