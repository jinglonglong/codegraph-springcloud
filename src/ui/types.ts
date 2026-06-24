/**
 * Messages from main thread to shimmer worker.
 *
 * `add-phase` / `update-phase` / `complete-phase` are the modern multi-stage
 * API. `legacy-update` keeps backward compatibility with the old single-bar
 * `onProgress({ phase, current, total })` calls.
 */
export type ShimmerWorkerMessage =
  | { type: 'add-phase'; id: string; label: string; description?: string }
  | { type: 'start-phase'; id: string }
  | { type: 'update-phase'; id: string; current: number; total: number; detail?: string }
  | { type: 'complete-phase'; id: string }
  | { type: 'legacy-update'; phase: string; label: string; description?: string; current: number; total: number }
  | { type: 'stop' };

/** Messages from worker to main thread */
export type ShimmerMainMessage =
  | { type: 'stopped' };
