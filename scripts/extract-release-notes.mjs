#!/usr/bin/env node
/**
 * Extract a release-notes block from CHANGELOG.md for a given version,
 * then unwrap hard-wrapped paragraphs.
 *
 * Why: GitHub renders release-note Markdown with GFM hard breaks, so
 * every `\n` becomes `<br>`. The CHANGELOG is hard-wrapped at ~75
 * chars for readable diffs, which then renders as awkward visible
 * line breaks on the release page. This script joins indented
 * continuation lines into a single line per bullet so the GFM
 * renderer produces clean paragraphs.
 *
 * Repo-level CHANGELOG.md viewing is unaffected (CommonMark treats
 * newlines as spaces there).
 *
 * Usage: extract-release-notes.mjs <version>
 *        e.g. extract-release-notes.mjs 0.7.10
 */

import { readFileSync } from 'fs';

const version = process.argv[2];
if (!version) {
  console.error('usage: extract-release-notes.mjs <version>');
  process.exit(1);
}

const escaped = version.replace(/\./g, '\\.');
const headerRe = new RegExp(`^## \\[${escaped}\\]`);
const anyHeaderRe = /^## \[/;

const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n');
const start = lines.findIndex((l) => headerRe.test(l));
if (start === -1) {
  console.error(`no '## [${version}]' entry found in CHANGELOG.md`);
  process.exit(1);
}
const after = lines.findIndex((l, i) => i > start && anyHeaderRe.test(l));
const block = lines.slice(start, after === -1 ? lines.length : after);

// Find the indent of the most recent list item; a continuation line
// whose indent is GREATER than that belongs to that item, otherwise
// it might belong to an ancestor item further up the stack.
//
// Track a stack of `{ indent: number }` frames so we can attach a
// continuation to the right ancestor. This correctly handles the
// post-nested-list continuation pattern:
//
//     - top-level
//         - nested
//       back to top-level  <- 2-space indent, joins the top-level bullet
const out = [];
let buf = '';                                // pending list-item text being built
let stack = [];                              // [{ indent: number }] open list items

function flushBuf() {
  if (buf !== '') {
    out.push(buf);
    buf = '';
  }
}

function leadingSpaces(s) {
  const m = s.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

const listItemRe = /^(\s*)([-*+]|\d+\.)\s+/;

for (const line of block) {
  if (/^\s*$/.test(line)) {
    flushBuf();
    out.push('');
    continue;
  }
  if (/^#/.test(line)) {
    flushBuf();
    stack = [];
    out.push(line);
    continue;
  }
  const itemMatch = line.match(listItemRe);
  if (itemMatch) {
    flushBuf();
    const indent = itemMatch[1].length;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    stack.push({ indent });
    buf = line;
    continue;
  }
  if (/^\s/.test(line)) {
    // Continuation. Pop any list frames deeper than this indent — the
    // continuation belongs to the nearest enclosing list item.
    const indent = leadingSpaces(line);
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      // Closes the deeper item — its buffered text is already in `buf`
      // belonging to the most recent flush. We need to flush before
      // re-buffering for the ancestor item.
      flushBuf();
      stack.pop();
    }
    const trimmed = line.replace(/^\s+/, '');
    buf = buf === '' ? trimmed : `${buf} ${trimmed}`;
    continue;
  }
  // Top-level non-list, non-heading (e.g. `[0.7.10]: https://...`)
  flushBuf();
  stack = [];
  out.push(line);
}
flushBuf();

process.stdout.write(out.join('\n'));
if (!out[out.length - 1]?.endsWith('\n')) process.stdout.write('\n');
