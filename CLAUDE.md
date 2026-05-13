# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeGraph is a local-first code intelligence system that builds a semantic knowledge graph from any codebase. It provides structural understanding of code relationships using tree-sitter for AST parsing and SQLite for storage.

**Key characteristics:**
- Headless library (no UI) - purely an API
- Node.js runtime (works standalone, in Electron, or any Node environment)
- Per-project data stored in `.codegraph/` directory
- Deterministic extraction from AST, not AI-generated summaries

## Build and Development Commands

```bash
# Build
npm run build          # Compile TypeScript and copy assets

# Test
npm test               # Run all tests once
npm run test:watch     # Run tests in watch mode

# Clean
npm run clean          # Remove dist/ directory
```

## Running a Single Test

```bash
npx vitest run __tests__/extraction.test.ts           # Run specific test file
npx vitest run __tests__/extraction.test.ts -t "TypeScript"  # Run tests matching pattern
```

## Architecture

### Core Module Structure

```
src/
├── index.ts              # Main CodeGraph class - public API entry point
├── types.ts              # All TypeScript interfaces and types
├── db/                   # SQLite database layer
│   ├── index.ts          # DatabaseConnection class
│   ├── queries.ts        # QueryBuilder with prepared statements
│   └── schema.sql        # Table definitions with FTS5 search
├── extraction/           # Tree-sitter AST parsing
│   ├── index.ts          # ExtractionOrchestrator
│   ├── tree-sitter.ts    # Universal parser wrapper
│   └── grammars.ts       # Language detection and grammar loading
├── resolution/           # Reference resolver
│   ├── index.ts          # ReferenceResolver orchestrator
│   ├── import-resolver.ts
│   ├── name-matcher.ts
│   └── frameworks/       # Framework-specific patterns (React, Express, Laravel, etc.)
├── graph/                # Graph traversal and queries
│   ├── index.ts          # GraphQueryManager
│   ├── traversal.ts      # GraphTraverser (BFS/DFS, impact radius)
│   └── queries.ts        # High-level graph queries
├── context/              # Context building for AI assistants
│   ├── index.ts          # ContextBuilder
│   └── formatter.ts      # Markdown/JSON output formatting
├── sync/                 # Incremental update system
│   ├── index.ts
│   └── git-hooks.ts      # Post-commit hook management
├── installer/            # Interactive installer
│   ├── index.ts          # Installer orchestrator
│   ├── banner.ts         # ASCII art banner
│   ├── claude-md-template.ts # CLAUDE.md template generator
│   ├── config-writer.ts  # Configuration file writing
│   └── prompts.ts        # User prompts
├── mcp/                  # Model Context Protocol server
│   ├── index.ts          # MCPServer class
│   ├── tools.ts          # MCP tool definitions
│   └── transport.ts      # Stdio transport
└── bin/codegraph.ts      # CLI entry point
```

### Key Classes

- **CodeGraph** (`src/index.ts`): Main entry point. Lifecycle methods (`init`, `open`, `close`), indexing (`indexAll`, `sync`), graph queries (`traverse`, `getCallGraph`, `getImpactRadius`), context building (`buildContext`)

- **ExtractionOrchestrator** (`src/extraction/index.ts`): Coordinates file scanning, parsing, and storing. Uses tree-sitter native bindings for each supported language

- **GraphTraverser** (`src/graph/traversal.ts`): BFS/DFS traversal, call graph construction, impact radius calculation, path finding

- **ReferenceResolver** (`src/resolution/index.ts`): Resolves unresolved references after full indexing using framework patterns, import resolution, and name matching

### Database Schema

SQLite database with:
- `nodes`: Code symbols (functions, classes, methods, etc.)
- `edges`: Relationships (calls, imports, extends, contains, etc.)
- `files`: Tracked source files with content hashes
- `unresolved_refs`: References pending resolution
- `nodes_fts`: FTS5 virtual table for full-text search

### Supported Languages

TypeScript, JavaScript, TSX, JSX, Svelte, Python, Go, Rust, Java, C, C++, C#, PHP, Ruby, Swift, Kotlin, Dart, Liquid, Pascal

### Node and Edge Types

**NodeKind**: `file`, `module`, `class`, `struct`, `interface`, `trait`, `protocol`, `function`, `method`, `property`, `field`, `variable`, `constant`, `enum`, `enum_member`, `type_alias`, `namespace`, `parameter`, `import`, `export`, `route`, `component`

**EdgeKind**: `contains`, `calls`, `imports`, `exports`, `extends`, `implements`, `references`, `type_of`, `returns`, `instantiates`, `overrides`, `decorates`

## CLI Usage

```bash
codegraph init [path]       # Initialize in project
codegraph index [path]      # Full index
codegraph sync [path]       # Incremental update
codegraph status [path]     # Show statistics
codegraph query <search>    # Search symbols
codegraph context <task>    # Build context for AI
codegraph hooks install     # Install git auto-sync
codegraph serve --mcp       # Start MCP server
```

## MCP Tools Best Practices

Use these tools **directly in the main session** for fast code exploration (replaces the need for Explore agents in most cases):

| Tool | Use For |
|------|---------|
| `codegraph_explore` | **Deep exploration** — comprehensive context for a topic in ONE call |
| `codegraph_context` | Quick context for a task (lighter than explore) |
| `codegraph_search` | Find symbols by name (functions, classes, types) |
| `codegraph_callers` | Find what calls a function |
| `codegraph_callees` | Find what a function calls |
| `codegraph_impact` | See what's affected by changing a symbol |
| `codegraph_node` | Get details + source code for a symbol |

### Important
CodeGraph provides **code context**, not product requirements. For new features, still ask the user about:
- UX preferences and behavior
- Edge cases and error handling
- Acceptance criteria

## Releases

Releases are published to npm **and** mirrored as GitHub Releases on the
[Releases page](https://github.com/colbymchenry/codegraph/releases), which is
where most users look for change history. `CHANGELOG.md` at the repo root is
the source of truth — each GitHub Release's notes are extracted from it.

### Writing changelog entries

When the user asks for a changelog entry for a new version:

1. Add a new `## [X.Y.Z] - YYYY-MM-DD` block at the **top** of `CHANGELOG.md`
   (directly under the intro, above the previous version).
2. Group changes under `### Added`, `### Changed`, `### Fixed`, `### Removed`,
   `### Deprecated`, `### Security` — only include sections that have entries.
3. Write entries from the **user's perspective**, not the implementation's.
   Lead with the observable symptom or capability, then mention internals only
   if a user needs them (e.g., to work around an existing bad install).
4. Add the link reference at the bottom:
   `[X.Y.Z]: https://github.com/colbymchenry/codegraph/releases/tag/vX.Y.Z`

### Release commands (the user runs these)

After the changelog entry is written and the version is bumped in `package.json`:

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "release: X.Y.Z (<one-line summary>)"
git push

npm publish

git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --notes-file <(awk '/^## \[X.Y.Z\]/,/^## \[/{ if (/^## \[/ && !/X.Y.Z/) exit; print }' CHANGELOG.md)
```

Do **not** run `npm publish`, `git tag`, `git push`, or `gh release create`
yourself — these are publish actions that affect shared state. Write the file,
hand the user the commands.

## Test Structure

Tests are in `__tests__/` directory with files mirroring the module structure:
- `foundation.test.ts` - Database, config, directory management
- `extraction.test.ts` - Tree-sitter parsing for all languages
- `resolution.test.ts` - Reference resolution
- `graph.test.ts` - Traversal and graph queries
- `context.test.ts` - Context building
- `sync.test.ts` - Incremental updates and git hooks

Tests use temporary directories created with `fs.mkdtempSync` and cleaned up after each test.
