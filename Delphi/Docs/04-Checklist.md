# Checklist: Pascal/Delphi Support in CodeGraph

## A) Plumbing
- [ ] tree-sitter grammar dependency (Pascal)
- [ ] Language registry: `pascal` hinzufügen
- [ ] Extension mapping: `.pas .dpr .dpk .lpr` (optional `.inc`)
- [ ] Queries laden (nodes + edges)

## B) Extraction
- [ ] Unit/Program/Package Nodes
- [ ] Class/Interface/Record Nodes
- [ ] Procedure/Function Nodes
- [ ] Method Nodes
- [ ] uses -> imports edges
- [ ] extends edges
- [ ] implements edges
- [ ] calls edges (best-effort)

## C) Resolution
- [ ] unitName -> file/node mapping
- [ ] resolve `uses X;` to unit node
- [ ] resolve `X in 'path'` (DPR/DPK) (Phase 2)
- [ ] call resolution baseline (same file + class)

## D) Testing
- [ ] add fixtures to tests
- [ ] assert extracted nodes
- [ ] assert imports/extends/implements/calls

## E) Polishing
- [ ] expose language in `Supported Languages` docs
- [ ] update CLI help / config validation
