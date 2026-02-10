# Unit Resolution Heuristics (uses → File)

## Input

- Extracted edges of kind `imports` from `uses` clauses.
- Extracted nodes of kind `unit|program|package|library` with their names.

## MVP Algorithm

1. Build `unitName -> nodeId` map for all indexed files.
2. For each `imports` edge with target name `X`:
   - try exact match `X`
   - try case-insensitive match
   - try namespace normalization:
     - `System.SysUtils` may correspond to unit `SysUtils` (optional heuristic)
3. If resolved: store `edge.to_node_id = targetNodeId`.
4. If not resolved: keep `edge.to_symbol = X` so search still works.

## DPR/DPK "in 'path'" cases (Phase 2)

In Delphi project files you can have:

```
uses
  Foo in 'src/Foo.pas',
  Bar in 'Bar.pas';
```

Enhancement:
- Parse optional path literal and resolve directly to file.
