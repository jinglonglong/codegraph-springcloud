/**
 * Lightweight Sentry client for CodeGraph — uses the HTTP envelope API directly.
 * No @sentry/node dependency, works in any Node.js environment.
 */

import { createHash } from 'crypto';

const DSN = 'https://9591f8aca69bcf98e9feb31544200b47@o1181972.ingest.us.sentry.io/4510840133713920';
const DSN_PARTS = DSN.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
const PUBLIC_KEY = DSN_PARTS![1];
const HOST = DSN_PARTS![2];
const PROJECT_ID = DSN_PARTS![3];
const STORE_URL = `https://${HOST}/api/${PROJECT_ID}/envelope/`;

let _enabled = false;
let _release = 'codegraph@unknown';
let _tags: Record<string, string> = {};

/**
 * Initialize Sentry error reporting.
 * Safe to call multiple times — subsequent calls update tags/release.
 *
 * Opt out by setting the environment variable CODEGRAPH_TELEMETRY=off
 */
export function initSentry({ processName, version }: { processName: string; version?: string }) {
  // Skip in development/test environments
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }
  // Respect user opt-out
  const telemetry = process.env.CODEGRAPH_TELEMETRY?.toLowerCase();
  if (telemetry === 'off' || telemetry === '0' || telemetry === 'false') {
    return;
  }
  _enabled = true;
  _release = `codegraph@${version ?? process.env.npm_package_version ?? 'unknown'}`;
  _tags = { processName };
}

/**
 * Send an error to Sentry with full stack trace and context.
 * Fire-and-forget — never throws, never blocks.
 */
export function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!_enabled) return;

  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const msg = err.message.toLowerCase();

    // Filter non-actionable noise
    if (msg.includes('pty') || msg.includes('terminal session')) return;
    if ((msg.includes('econnrefused') || msg.includes('econnreset')) && msg.includes('127.0.0.1')) return;

    const eventId = createHash('md5').update(`${Date.now()}-${Math.random()}`).digest('hex');
    const timestamp = new Date().toISOString();

    // Attach CodeGraphError context if available
    const errorContext: Record<string, unknown> = { ...extra };
    if ('code' in err && typeof (err as any).code === 'string') {
      errorContext.errorCode = (err as any).code;
    }
    if ('context' in err && typeof (err as any).context === 'object') {
      Object.assign(errorContext, (err as any).context);
    }

    const event: Record<string, unknown> = {
      event_id: eventId,
      timestamp,
      platform: 'node',
      level: 'error',
      release: _release,
      tags: _tags,
      exception: {
        values: [{
          type: err.name,
          value: err.message,
          stacktrace: parseStack(err.stack),
        }],
      },
    };

    if (Object.keys(errorContext).length > 0) {
      event.extra = errorContext;
    }

    const payload = JSON.stringify(event);
    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn: DSN }),
      JSON.stringify({ type: 'event', length: payload.length }),
      payload,
    ].join('\n') + '\n';

    fetch(STORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${PUBLIC_KEY}`,
      },
      body: envelope,
    }).catch(() => {});
  } catch {
    // Never throw from error reporting
  }
}

/**
 * Send a message-level event to Sentry (for logged errors without Error objects).
 */
export function captureMessage(message: string, context?: Record<string, unknown>) {
  if (!_enabled) return;

  try {
    const eventId = createHash('md5').update(`${Date.now()}-${Math.random()}`).digest('hex');
    const timestamp = new Date().toISOString();

    const event: Record<string, unknown> = {
      event_id: eventId,
      timestamp,
      platform: 'node',
      level: 'error',
      release: _release,
      tags: _tags,
      message: { formatted: message },
    };

    if (context && Object.keys(context).length > 0) {
      event.extra = context;
    }

    const payload = JSON.stringify(event);
    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn: DSN }),
      JSON.stringify({ type: 'event', length: payload.length }),
      payload,
    ].join('\n') + '\n';

    fetch(STORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${PUBLIC_KEY}`,
      },
      body: envelope,
    }).catch(() => {});
  } catch {
    // Never throw from error reporting
  }
}

/**
 * Parse a Node.js Error.stack string into Sentry's stacktrace format.
 */
function parseStack(stack?: string): { frames: Array<{ filename: string; function: string; lineno?: number; colno?: number }> } | undefined {
  if (!stack) return undefined;

  const frames = stack
    .split('\n')
    .slice(1)
    .map((line) => {
      const match = line.match(/^\s+at\s+(?:(.+?)\s+\()?(.*?):(\d+):(\d+)\)?$/);
      if (!match || !match[2] || !match[3] || !match[4]) return null;
      return {
        function: match[1] || '<anonymous>',
        filename: match[2],
        lineno: parseInt(match[3], 10),
        colno: parseInt(match[4], 10),
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .reverse();

  return frames.length > 0 ? { frames } : undefined;
}
