import { parentPort, workerData } from 'worker_threads';
import { getGlyphs } from './glyphs';

/**
 * Shimmer Worker — multi-stage progress renderer.
 *
 * Renders one line per registered phase. The first line is the topmost.
 * Cursor is left at the start of the line immediately below the last
 * phase, so the caller can keep printing other output (e.g. a final
 * summary) without further shenanigans.
 *
 * Each phase has a status:
 *   - pending  — registered, not started
 *   - running  — currently receiving updates (shimmer animation)
 *   - done     — finished (green check + filled bar)
 *
 * The worker maintains a single Map<id, state> and re-renders the whole
 * list on a fixed interval (~80ms). The main thread only sends
 * small mutation messages; rendering happens entirely in this thread
 * so a blocked main thread (e.g. mid-SQLite write) doesn't freeze the
 * animation.
 *
 * Output uses `process.stdout.write` (not `fs.writeSync(1, ...)`) so
 * Node's TTY-aware encoding conversion runs — on Windows the active
 * console codepage (often CP936/CP949 for CJK) is honored, which keeps
 * Chinese / Japanese / Korean glyphs readable. The previous `writeSync`
 * approach wrote raw UTF-8 bytes which mojibaked on those codepages
 * (see #168). Trade-off: stdout writes from a worker go through the
 * main thread's stdout proxy; if the main thread is mid-SQLite the
 * worker's redraw can stall for the duration of that write. Acceptable
 * here because the render loop is cosmetic — no data is at risk.
 */

type PhaseState = {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'done';
  current: number;
  total: number;
  detail: string;
  startTime: number;
  endTime: number | null;
};

type WorkerInputMessage =
  | { type: 'add-phase'; id: string; label: string; description?: string }
  | { type: 'start-phase'; id: string }
  | { type: 'update-phase'; id: string; current: number; total: number; detail?: string }
  | { type: 'complete-phase'; id: string }
  | { type: 'legacy-update'; phase: string; label: string; description?: string; current: number; total: number }
  | { type: 'stop' };

const G = getGlyphs();
const ANIM_INTERVAL = 150;
const FRAMES_PER_GLYPH = 3;
const RENDER_INTERVAL_MS = 80;
const BAR_WIDTH = 20;

const RST = '\x1b[0m';
const DM = '\x1b[2m';
const GRN = '\x1b[32m';
const BOLD = '\x1b[1m';

const startTime: number = (workerData?.startTime as number | undefined) ?? Date.now();

const phases = new Map<string, PhaseState>();
const order: string[] = [];
let lineCount = 0;
let renderInterval: NodeJS.Timeout | null = null;

function animFrame(): number {
  return Math.floor((Date.now() - startTime) / ANIM_INTERVAL);
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function shimmerColor(frame: number): string {
  const t = (Math.sin(frame * 2 * Math.PI / 13) + 1) / 2;
  const r = lerp(160, 251, t);
  const g = lerp(100, 191, t);
  const b = lerp(9, 36, t);
  return `\x1b[38;2;${r};${g};${b}m${BOLD}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m${(s - m * 60).toFixed(0)}s`;
}

function renderBar(frame: number, percent: number): string {
  if (percent <= 0) return `${DM}${G.barEmpty.repeat(BAR_WIDTH)}${RST}`;
  if (percent >= 100) return `${GRN}${G.barFilled.repeat(BAR_WIDTH)}${RST}`;
  const filled = Math.round((BAR_WIDTH * percent) / 100);
  const empty = BAR_WIDTH - filled;
  const cycleFrames = 24;
  const shimmerPos = ((frame % cycleFrames) / cycleFrames) * (filled + 6) - 3;
  const shimmerWidth = 3;
  let bar = '';
  for (let i = 0; i < filled; i++) {
    const dist = Math.abs(i - shimmerPos);
    const t = Math.max(0, 1 - dist / shimmerWidth);
    const r = lerp(160, 251, t);
    const g = lerp(100, 191, t);
    const b = lerp(9, 36, t);
    bar += `\x1b[38;2;${r};${g};${b}m${BOLD}${G.barFilled}`;
  }
  bar += `${RST}${DM}${G.barEmpty.repeat(empty)}${RST}`;
  return bar;
}

function formatProgress(phase: PhaseState): string {
  if (phase.total > 0) {
    const percent = Math.round((phase.current / phase.total) * 100);
    const cur = formatNumber(phase.current);
    const tot = formatNumber(phase.total);
    return `${renderBar(animFrame(), percent)}  ${cur}/${tot} (${percent}%)`;
  }
  if (phase.current > 0) {
    return `${formatNumber(phase.current)} 个`;
  }
  return '';
}

function renderPhaseLine(frame: number, phase: PhaseState): string {
  const glyph = G.spinner[Math.floor(frame / FRAMES_PER_GLYPH) % G.spinner.length] ?? G.spinner[0] ?? '·';
  const color = shimmerColor(frame);

  let statusIcon: string;
  let iconColor: string;
  if (phase.status === 'done') {
    statusIcon = G.phaseDone;
    iconColor = GRN;
  } else if (phase.status === 'running') {
    statusIcon = glyph;
    iconColor = color;
  } else {
    statusIcon = G.rail;
    iconColor = DM;
  }

  // Pad label to a fixed width so columns align. Chinese chars are 2 cells
  // wide in CJK-aware terminals, but we don't measure that here — over-padding
  // is fine, mis-alignment is the bigger sin. Use a generous pad.
  const padded = phase.label.length >= 14 ? phase.label : phase.label + '　'.repeat(14 - phase.label.length);

  const progress = phase.status === 'pending' && phase.total === 0 ? '' : `  ${formatProgress(phase)}`;
  const desc = phase.description ? `  ${DM}${phase.description}${RST}` : '';
  const detail = phase.detail ? `  ${color}${phase.detail}${RST}` : '';

  let timing = '';
  if (phase.status === 'done' && phase.endTime !== null) {
    timing = `  ${DM}${G.dash} ${formatDuration(phase.endTime - phase.startTime)}${RST}`;
  } else if (phase.status === 'running') {
    timing = `  ${DM}${formatDuration(Date.now() - phase.startTime)}${RST}`;
  }

  return `${iconColor}${statusIcon}${RST} ${padded}${progress}${desc}${detail}${timing}`;
}

function render(): void {
  if (order.length === 0) return;
  const frame = animFrame();

  // Move cursor up to the topmost line of our output.
  if (lineCount > 0) {
    process.stdout.write(`\x1b[${lineCount}A`);
  }

  // Clear and redraw each line. End with \n on every line except the last
  // so cursor lands at col 0 of the line immediately after the final phase.
  for (let i = 0; i < order.length; i++) {
    const id = order[i]!;
    const phase = phases.get(id);
    if (!phase) continue;
    process.stdout.write('\r\x1b[K');
    process.stdout.write(renderPhaseLine(frame, phase));
    if (i < order.length - 1) {
      process.stdout.write('\n');
    }
  }

  lineCount = order.length;
}

function ensureRenderLoop(): void {
  if (renderInterval === null) {
    renderInterval = setInterval(render, RENDER_INTERVAL_MS);
  }
}

parentPort?.on('message', (msg: WorkerInputMessage) => {
  switch (msg.type) {
    case 'add-phase': {
      if (!phases.has(msg.id)) {
        phases.set(msg.id, {
          id: msg.id,
          label: msg.label,
          description: msg.description ?? '',
          status: 'pending',
          current: 0,
          total: 0,
          detail: '',
          startTime: Date.now(),
          endTime: null,
        });
        order.push(msg.id);
        ensureRenderLoop();
      }
      break;
    }
    case 'start-phase': {
      const phase = phases.get(msg.id);
      if (phase && phase.status === 'pending') {
        phase.status = 'running';
        phase.startTime = Date.now();
      }
      break;
    }
    case 'update-phase': {
      const phase = phases.get(msg.id);
      if (phase) {
        if (phase.status === 'pending') {
          phase.status = 'running';
          phase.startTime = Date.now();
        }
        phase.current = msg.current;
        phase.total = msg.total;
        if (msg.detail !== undefined) phase.detail = msg.detail;
      }
      break;
    }
    case 'complete-phase': {
      const phase = phases.get(msg.id);
      if (phase) {
        phase.status = 'done';
        phase.endTime = Date.now();
        if (phase.total === 0 && phase.current > 0) phase.total = phase.current;
      }
      break;
    }
    case 'legacy-update': {
      // Auto-register a phase from the old onProgress({ phase, current, total })
      // API. Mirrors the old single-bar behavior: each new phase id implicitly
      // marks the previous as done.
      const existing = phases.get(msg.phase);
      if (!existing) {
        // Mark any other running phase as done first (single-bar fallback).
        for (const id of order) {
          const other = phases.get(id)!;
          if (other.status === 'running') {
            other.status = 'done';
            other.endTime = Date.now();
          }
        }
        phases.set(msg.phase, {
          id: msg.phase,
          label: msg.label,
          description: String(msg.description ?? ''),
          status: 'running',
          current: msg.current,
          total: msg.total,
          detail: '',
          startTime: Date.now(),
          endTime: null,
        });
        order.push(msg.phase);
      } else {
        existing.status = 'running';
        existing.current = msg.current;
        existing.total = msg.total;
      }
      ensureRenderLoop();
      break;
    }
    case 'stop': {
      if (renderInterval !== null) {
        clearInterval(renderInterval);
        renderInterval = null;
      }
      // Mark any still-running phases as done so the final frame is clean.
      for (const id of order) {
        const phase = phases.get(id)!;
        if (phase.status === 'running') {
          phase.status = 'done';
          phase.endTime = Date.now();
        }
      }
      render();
      // Drop below our last line so the caller can keep printing.
      if (lineCount > 0) {
        process.stdout.write('\n');
        lineCount = 0;
      }
      parentPort?.postMessage({ type: 'stopped' });
      break;
    }
  }
});
