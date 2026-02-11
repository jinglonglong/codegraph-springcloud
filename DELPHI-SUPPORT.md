# Pascal / Delphi Support for CodeGraph

## Why Delphi?

Delphi (Object Pascal) remains one of the most widely used languages for Windows desktop and enterprise applications. With an estimated **1.5–3 million active developers** and a strong presence in industries like healthcare, finance, logistics, and government, Delphi projects often involve large, long-lived codebases that benefit significantly from semantic code intelligence.

Many Delphi codebases have grown over decades — making structural understanding, impact analysis, and cross-file navigation exactly the kind of tooling gap CodeGraph is designed to fill.

Adding Delphi support positions CodeGraph as a uniquely valuable tool for a community that has historically been underserved by modern static analysis and AI-assisted development tools.

## What Was Implemented

### Pascal / Object Pascal (tree-sitter)

Full extraction support for `.pas`, `.dpr`, `.dpk`, and `.lpr` files using the `tree-sitter-pascal` grammar:

| Feature | NodeKind | Details |
|---------|----------|---------|
| Units / Programs | `module` | `unit`, `program`, `package`, `library` |
| Classes | `class` | Including inheritance and interface implementation |
| Records | `class` | Treated as classes (consistent with AST structure) |
| Interfaces | `interface` | With GUID support |
| Methods | `method` | Constructor, destructor, procedures, functions |
| Functions / Procedures | `function` | Top-level (non-class) routines |
| Properties | `property` | With read/write accessors |
| Fields | `field` | Class and record fields |
| Constants | `constant` | `const` declarations |
| Enums | `enum` | With enum members |
| Type Aliases | `type_alias` | `type TFoo = ...` |
| Uses / Imports | `import` | `uses` clause extraction |
| Function Calls | — | `calls` edges for call graph |
| Visibility | — | `public`, `private`, `protected` on methods/fields |
| Static Methods | — | `class function` / `class procedure` |
| Containment | — | `contains` edges (class → method, unit → type, etc.) |
| Inheritance | — | `extends` / `implements` edges |

### DFM / FMX Form Files (custom extractor)

Support for Delphi form files (`.dfm` for VCL, `.fmx` for FireMonkey) using a regex-based custom extractor — no tree-sitter grammar exists for this format:

| Feature | NodeKind / EdgeKind | Details |
|---------|---------------------|---------|
| Components | `component` | `object Button1: TButton` |
| Nested hierarchy | `contains` | Panel1 → Button1 |
| Event handlers | `references` (unresolved) | `OnClick = Button1Click` → links UI to Pascal methods |
| `inherited` keyword | `component` | Inherited form components |
| Multi-line properties | — | Correctly skipped during parsing |
| Item collections | — | `<item>...</end>` blocks correctly handled |

The DFM ↔ PAS linkage via event handlers enables **cross-file impact analysis**: renaming a method in `.pas` immediately reveals which UI components reference it.

## Architecture

The implementation follows CodeGraph's established patterns:

- **Pascal extraction** uses the standard `TreeSitterExtractor` with a Pascal-specific `LanguageExtractor` configuration and a `visitPascalNode()` hook for AST nodes that require special handling (e.g., `declType` wrappers, `defProc` implementation bodies)
- **DFM/FMX extraction** uses a `DfmExtractor` class — analogous to `LiquidExtractor` and `SvelteExtractor` — that parses the line-based format with regex
- **Routing** in `extractFromSource()` dispatches `.dfm`/`.fmx` files to `DfmExtractor` before reaching the tree-sitter path
- **`tree-sitter-pascal`** is declared as an `optionalDependency` (consistent with all other grammars), pinned to a specific commit for reproducible builds

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | Added `'pascal'` to `Language` type, file patterns to `DEFAULT_CONFIG.include` |
| `src/extraction/grammars.ts` | Grammar loader, extension mappings (`.pas`, `.dpr`, `.dpk`, `.lpr`, `.dfm`, `.fmx`), display name |
| `src/extraction/tree-sitter.ts` | Pascal `LanguageExtractor`, `visitPascalNode()` with 7 helper methods, `DfmExtractor` class, routing in `extractFromSource()` |
| `package.json` | `tree-sitter-pascal` in `optionalDependencies` (pinned commit) |
| `__tests__/extraction.test.ts` | 36 new tests covering all Pascal and DFM extraction features |

## Test Results

- **36 new tests**, all passing
- **0 regressions** — the same 28 pre-existing failures (unrelated: missing Swift/Dart grammars, database path issues, MCP truncation test) are unchanged
- Tests cover: language detection, modules, imports, classes, records, interfaces, methods, visibility, static methods, enums, properties, constants, type aliases, calls, containment, full fixture files (UAuth.pas, UTypes.pas, MainForm.dfm)

## Dependency Note

The npm package `tree-sitter-pascal@0.0.1` is outdated (uses NAN bindings, incompatible with Node.js v24+). The implementation uses the actively maintained GitHub repository ([Isopod/tree-sitter-pascal](https://github.com/Isopod/tree-sitter-pascal), v0.10.2) with a pinned commit hash for deterministic builds. This is consistent with how `@sengac/tree-sitter-dart` handles a similar situation.
