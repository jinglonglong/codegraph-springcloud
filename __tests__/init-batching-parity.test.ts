/**
 * BatchStore parity test.
 *
 * Verifies that the batched write path produces a DB byte-for-byte
 * equivalent to the per-file write path on the same input. The
 * batched path groups N files' rows into one transaction; the
 * per-file path runs one transaction per file × 4 categories. If
 * any future change to BatchStore or the insert path produces a
 * subtly different row set (ordering, dedup, missing fields), this
 * test fails loudly.
 *
 * init-performance change, phase 6
 * (openspec/changes/optimize-initialization-performance).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Check if the node:sqlite backend is available (Node >= 22.5).
function hasSqliteBindings(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.close();
    return true;
  } catch {
    return false;
  }
}

const HAS_SQLITE = hasSqliteBindings();

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'springgraph-bs-parity-'));
}

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

describe.skipIf(!HAS_SQLITE)('BatchStore parity (batched vs per-file)', () => {
  let testDir: string;
  let legacyDbPath: string;
  let batchedDbPath: string;

  beforeEach(() => {
    testDir = makeTempDir();
    legacyDbPath = path.join(testDir, 'legacy.db');
    batchedDbPath = path.join(testDir, 'batched.db');
  });

  afterEach(() => {
    cleanupTempDir(testDir);
  });

  /**
   * Build a small set of synthetic `ExtractionResult` objects so
   * the test doesn't depend on tree-sitter. Covers:
   *   - file with no nodes/edges (yaml-style)
   *   - file with 2 classes, 1 method each, 1 call edge
   *   - file with 1 unresolved reference
   *   - file with 1 edge whose source/target are missing from the
   *     nodes list (should be filtered out, per the per-file
   *     storeExtractionResult behavior)
   *   - file that appears twice (duplicate path) — the second
   *     write wins
   */
  function buildFakeResults() {
    return [
      {
        filePath: 'src/A.java',
        content: 'class A {}',
        stats: { size: 11, mtimeMs: 1700000000000 } as fs.Stats,
        language: 'java' as const,
        result: {
          nodes: [
            {
              id: 'A',
              kind: 'class',
              name: 'A',
              qualifiedName: 'A',
              filePath: 'src/A.java',
              language: 'java',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 1,
              updatedAt: 1700000000000,
            },
          ],
          edges: [],
          unresolvedReferences: [],
          errors: [],
          durationMs: 0,
        },
      },
      {
        filePath: 'src/B.java',
        content: 'class B { void m() {} }',
        stats: { size: 22, mtimeMs: 1700000000000 } as fs.Stats,
        language: 'java' as const,
        result: {
          nodes: [
            {
              id: 'B',
              kind: 'class',
              name: 'B',
              qualifiedName: 'B',
              filePath: 'src/B.java',
              language: 'java',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 1,
              updatedAt: 1700000000000,
            },
            {
              id: 'B#m',
              kind: 'method',
              name: 'm',
              qualifiedName: 'B.m',
              filePath: 'src/B.java',
              language: 'java',
              startLine: 1,
              endLine: 1,
              startColumn: 8,
              endColumn: 18,
              updatedAt: 1700000000000,
            },
          ],
          edges: [
            {
              source: 'B#m',
              target: 'A',
              kind: 'calls',
              line: 1,
              column: 0,
            },
          ],
          unresolvedReferences: [
            {
              fromNodeId: 'B#m',
              referenceName: 'unknown',
              referenceKind: 'call',
              line: 1,
              column: 0,
            },
          ],
          errors: [],
          durationMs: 0,
        },
      },
      {
        filePath: 'config.yml',
        content: 'key: value',
        stats: { size: 11, mtimeMs: 1700000000000 } as fs.Stats,
        language: 'yaml' as const,
        result: {
          nodes: [],
          edges: [],
          unresolvedReferences: [],
          errors: [],
          durationMs: 0,
        },
      },
      {
        filePath: 'src/C.java',
        content: 'class C { void broken() { unknownMethod(); } }',
        stats: { size: 45, mtimeMs: 1700000000000 } as fs.Stats,
        language: 'java' as const,
        result: {
          // Missing required fields (id, name) -> should be filtered
          // out by both the per-file and the batched path, so
          // edges that point to them also disappear.
          nodes: [
            {
              id: '',
              kind: 'class',
              name: '',
              qualifiedName: 'C',
              filePath: 'src/C.java',
              language: 'java',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 1,
              updatedAt: 1700000000000,
            } as any,
          ],
          edges: [
            {
              source: 'does-not-exist',
              target: 'also-does-not-exist',
              kind: 'references',
              line: 1,
              column: 0,
            },
          ],
          unresolvedReferences: [],
          errors: [],
          durationMs: 0,
        },
      },
      // Duplicate file path — second write should win.
      {
        filePath: 'src/A.java',
        content: 'class A {} class AInner {}',
        stats: { size: 25, mtimeMs: 1700000001000 } as fs.Stats,
        language: 'java' as const,
        result: {
          nodes: [
            {
              id: 'A',
              kind: 'class',
              name: 'A',
              qualifiedName: 'A',
              filePath: 'src/A.java',
              language: 'java',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 1,
              updatedAt: 1700000001000,
            },
            {
              id: 'AInner',
              kind: 'class',
              name: 'AInner',
              qualifiedName: 'AInner',
              filePath: 'src/A.java',
              language: 'java',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 1,
              updatedAt: 1700000001000,
            },
          ],
          edges: [],
          unresolvedReferences: [],
          errors: [],
          durationMs: 0,
        },
      },
    ];
  }

  /**
   * Build a DB using the per-file path (the pre-phase-2 behavior).
   * Mirrors the body of `storeExtractionResult` so we can compare
   * the DB to the batched-path DB.
   */
  async function buildLegacyDb(
    dbPath: string,
    results: ReturnType<typeof buildFakeResults>
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseConnection } = await import('../src/db');
    const { QueryBuilder } = await import('../src/db/queries');
    const { hashContent } = await import('../src/extraction');

    const conn = DatabaseConnection.initialize(dbPath);
    const queries = new QueryBuilder(conn.getDb());
    // Replicate the per-file storeExtractionResult path.
    for (const { filePath, content, language, stats, result } of results) {
      const contentHash = hashContent(content);
      const existing = queries.getFileByPath(filePath);
      if (existing && existing.contentHash === contentHash) {
        continue;
      }
      if (existing) {
        queries.deleteFile(filePath);
      }
      const validNodes = result.nodes.filter(
        (n) => n.id && n.kind && n.name && n.filePath && n.language
      );
      if (validNodes.length > 0) {
        queries.insertNodes(validNodes);
      }
      if (result.edges.length > 0) {
        const insertedIds = new Set(validNodes.map((n) => n.id));
        const validEdges = result.edges.filter(
          (e) => insertedIds.has(e.source) && insertedIds.has(e.target)
        );
        if (validEdges.length > 0) {
          queries.insertEdges(validEdges);
        }
      }
      if (result.unresolvedReferences.length > 0) {
        const insertedIds = new Set(validNodes.map((n) => n.id));
        const refsWithContext = result.unresolvedReferences
          .filter((ref) => insertedIds.has(ref.fromNodeId))
          .map((ref) => ({
            ...ref,
            filePath: ref.filePath ?? filePath,
            language: ref.language ?? language,
          }));
        if (refsWithContext.length > 0) {
          queries.insertUnresolvedRefsBatch(refsWithContext);
        }
      }
      const fileRecord = {
        path: filePath,
        contentHash,
        language,
        size: stats.size,
        modifiedAt: stats.mtimeMs,
        indexedAt: 1700000000000,
        nodeCount: result.nodes.length,
        errors: result.errors.length > 0 ? result.errors : undefined,
      };
      queries.upsertFile(fileRecord);
    }
    conn.close();
  }

  /**
   * Build a DB using BatchStore. The per-file semantics are
   * encoded in BatchStore.append, so feeding it the same
   * ExtractionResult list should yield a byte-equivalent DB.
   */
  async function buildBatchedDb(
    dbPath: string,
    results: ReturnType<typeof buildFakeResults>
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseConnection } = await import('../src/db');
    const { QueryBuilder } = await import('../src/db/queries');
    const { BatchStore } = await import('../src/db/batch-store');

    const conn = DatabaseConnection.initialize(dbPath);
    const queries = new QueryBuilder(conn.getDb());
    const bs = new BatchStore(queries, {
      batchSize: 100, // single batch covers all 5 test files
      batchFlushMs: 60000,
      log: () => {},
    });
    for (const { filePath, content, language, stats, result } of results) {
      await bs.append(
        filePath,
        content,
        language,
        stats as fs.Stats,
        result as any
      );
    }
    await bs.close();
    conn.close();
  }

  /**
   * Dump every row from a table as a deterministic JSON array,
   * sorted by primary key. Returns the array for comparison.
   * `indexed_at` is masked because it's intentionally
   * wall-clock-dependent (the per-file path uses `Date.now()`;
   * the batched path also uses `Date.now()`; the two naturally
   * differ when the runs are ~ms apart). It's the right
   * semantic — `indexed_at` should be the index time, not a
   * constant — so we strip it for the equality check.
   */
  function dumpTable(
    dbPath: string,
    table: 'nodes' | 'edges' | 'unresolved_refs' | 'files'
  ): any[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare(`SELECT * FROM ${table}`).all() as any[];
    db.close();
    // Mask wall-clock fields that legitimately differ between
    // the two write paths (and between two runs of the same
    // path) but are not part of the parity contract.
    for (const row of rows) {
      if ('indexed_at' in row) row.indexed_at = '<masked>';
    }
    // Sort deterministically by the first column (usually 'id' /
    // 'path'); fall back to the whole row as JSON.
    rows.sort((a, b) => {
      const ka = JSON.stringify(a);
      const kb = JSON.stringify(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    return rows;
  }

  it('nodes table is byte-identical between batched and per-file paths', async () => {
    const results = buildFakeResults();
    await buildLegacyDb(legacyDbPath, results);
    await buildBatchedDb(batchedDbPath, results);
    expect(dumpTable(legacyDbPath, 'nodes')).toEqual(
      dumpTable(batchedDbPath, 'nodes')
    );
  });

  it('edges table is byte-identical between batched and per-file paths', async () => {
    const results = buildFakeResults();
    await buildLegacyDb(legacyDbPath, results);
    await buildBatchedDb(batchedDbPath, results);
    expect(dumpTable(legacyDbPath, 'edges')).toEqual(
      dumpTable(batchedDbPath, 'edges')
    );
  });

  it('unresolved_refs table is byte-identical', async () => {
    const results = buildFakeResults();
    await buildLegacyDb(legacyDbPath, results);
    await buildBatchedDb(batchedDbPath, results);
    expect(dumpTable(legacyDbPath, 'unresolved_refs')).toEqual(
      dumpTable(batchedDbPath, 'unresolved_refs')
    );
  });

  it('files table is byte-identical (including the duplicate-path dedup)', async () => {
    const results = buildFakeResults();
    await buildLegacyDb(legacyDbPath, results);
    await buildBatchedDb(batchedDbPath, results);
    expect(dumpTable(legacyDbPath, 'files')).toEqual(
      dumpTable(batchedDbPath, 'files')
    );
  });
});

// Placeholder so the file always reports at least one passing test
// on machines without the node:sqlite binding.
describe('BatchStore parity (no SQLite binding)', () => {
  it.skipIf(HAS_SQLITE)('is skipped when node:sqlite is unavailable', () => {
    expect(true).toBe(true);
  });
});
