# CodeGraph Search Quality Loop

You are testing and improving CodeGraph's search quality for a specific language. The user will give you a real-world codebase path to test against.

## What You're Fixing

When an LLM queries CodeGraph via MCP tools (`codegraph_search`, `codegraph_explore`, `codegraph_callees`), the results must be relevant. The main failure mode is: methods with common names (like `run`, `get`, `handle`) flood results and bury the actual target. The fix is usually adding `getReceiverType` to the language extractor so methods include their owner type in the FTS-indexed `qualified_name`.

**Example:** Go's `func (sl *scrapeLoop) run()` was indexed as `scrape.go::scrape.go::run`. After adding `getReceiverType`, it became `scrape.go::scrapeLoop::run` — now FTS can rank it above unrelated `run` methods when the query mentions "scrapeLoop".

## The Loop

### 1. Pick a test query

Choose a query that exercises the language's method-on-type pattern. Good queries mention:
- A specific type/class/struct name
- A method on that type
- A broader topic connecting multiple files

Example for Go: `"scrapeLoop run scrape lifecycle TSDB storage"`

### 2. Index the codebase

```bash
rm -rf <codebase_path>/.codegraph
node dist/bin/codegraph.js init -iv <codebase_path>
```

The `-iv` flag gives verbose output showing extraction progress, node/edge counts, and timing.

### 3. Check what the DB produced

```bash
# Does the method have its owner type in qualified_name?
sqlite3 <codebase_path>/.codegraph/codegraph.db \
  "SELECT name, kind, qualified_name FROM nodes WHERE name = '<method>' AND file_path LIKE '%<file>%';"

# GOOD: file.rs::StructName::method_name
# BAD:  file.rs::file.rs::method_name  ← owner type missing, FTS can't find it
```

### 4. Test search ranking

```bash
node -e "
const { CodeGraph } = require('./dist/index.js');
async function test() {
  const cg = await CodeGraph.open('<codebase_path>');

  // Does the target method rank #1?
  console.log('=== searchNodes ===');
  const results = cg.searchNodes('<OwnerType> <method>', { limit: 10, kinds: ['method'] });
  for (const r of results) {
    console.log(\`\${r.score.toFixed(2)} | \${r.node.name} (\${r.node.kind}) | \${r.node.filePath}:\${r.node.startLine}\`);
  }

  // Does explore find the right file?
  console.log('\n=== findRelevantContext ===');
  const subgraph = await cg.findRelevantContext('<your natural language query>', {
    searchLimit: 8, traversalDepth: 3, maxNodes: 80, minScore: 0.2,
  });
  const fileGroups = new Map();
  for (const node of subgraph.nodes.values()) {
    if (!fileGroups.has(node.filePath)) fileGroups.set(node.filePath, []);
    fileGroups.get(node.filePath).push(node.name);
  }
  console.log('Entry points:');
  for (const rootId of subgraph.roots.slice(0, 8)) {
    const node = subgraph.nodes.get(rootId);
    if (node) console.log(\`  \${node.name} (\${node.kind}) - \${node.filePath}:\${node.startLine}\`);
  }
  console.log('Top files:');
  for (const [file, nodes] of [...fileGroups.entries()].sort((a,b) => b[1].length - a[1].length).slice(0, 5)) {
    console.log(\`  \${file} (\${nodes.length}): \${nodes.slice(0, 5).join(', ')}\`);
  }

  // Does qualified lookup resolve correctly?
  console.log('\n=== qualified lookup ===');
  const qr = cg.searchNodes('<OwnerType>.<method>', { limit: 50 });
  const exact = qr.filter(r => r.node.qualifiedName.includes('<OwnerType>::<method>'));
  console.log(\`\${exact.length} match(es) for <OwnerType>.<method>\`);
  if (exact[0]) {
    const callees = cg.getCallees(exact[0].node.id);
    console.log('Callees:', callees.map(c => c.node.name).join(', '));
  }

  await cg.close();
}
test().catch(console.error);
"
```

### 5. If results are bad, diagnose and fix

| Symptom | Cause | Fix |
|---------|-------|-----|
| Target method not in top 10 of `searchNodes` | Owner type missing from `qualified_name` | Add `getReceiverType` to `src/extraction/languages/<lang>.ts` |
| Explore returns irrelevant files | Common method name flooding exact matches | Check co-location boost in `src/db/queries.ts: findNodesByExactName` |
| A key term is being dropped from search | It's in the STOP_WORDS list | Edit `src/search/query-utils.ts` |
| `<OwnerType>.<method>` returns "not found" | `qualified_name` doesn't contain `OwnerType::method` | Fix `getReceiverType` output |

### 6. Rebuild and re-test

```bash
npm run build
# If you changed extraction (getReceiverType), must re-index:
rm -rf <codebase_path>/.codegraph
node dist/bin/codegraph.js init -iv <codebase_path>
# Then re-run Step 4
```

### 7. Run the test suite before finishing

```bash
npm test
```

All 378+ tests must pass.

## How to Add `getReceiverType` for a Language

**Only needed for languages where methods are top-level or outside their owner type in the AST.** If the language nests methods inside class/struct bodies (Python, Java, TypeScript, C#), the qualified name already includes the parent — verify with Step 3 before adding anything.

### 1. Add the hook to the language extractor

In `src/extraction/languages/<lang>.ts`, add `getReceiverType` to the extractor object:

```typescript
getReceiverType: (node, source) => {
  // Extract the owner type name from the method's AST node.
  // Return the type name string, or undefined if not applicable.
  // 
  // The core extractMethod() in tree-sitter.ts will use this to set:
  //   qualifiedName = `${filePath}::${receiverType}::${methodName}`
},
```

### 2. Reference: Go implementation

```typescript
// src/extraction/languages/go.ts
getReceiverType: (node, source) => {
  const receiver = getChildByField(node, 'receiver');
  if (!receiver) return undefined;
  const text = getNodeText(receiver, source);
  const match = text.match(/\*?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/);
  return match?.[1];
},
```

### 3. Where it's consumed

`src/extraction/tree-sitter.ts` in `extractMethod()`:

```typescript
const receiverType = this.extractor.getReceiverType?.(node, this.source);
if (receiverType) {
  extraProps.qualifiedName = `${this.filePath}::${receiverType}::${name}`;
}
```

## Key Files

| File | Role |
|------|------|
| `src/extraction/languages/<lang>.ts` | Language extractor — implement `getReceiverType` here |
| `src/extraction/tree-sitter.ts` | Core extraction — `extractMethod()` uses the hook |
| `src/extraction/tree-sitter-types.ts` | `LanguageExtractor` interface definition |
| `src/search/query-utils.ts` | `STOP_WORDS`, `extractSearchTerms`, `scorePathRelevance` |
| `src/db/queries.ts` | `searchNodesFTS` (BM25), `findNodesByExactName` (co-location) |
| `src/context/index.ts` | `findRelevantContext` — hybrid search + co-location boost |
| `src/mcp/tools.ts` | MCP handlers — `matchesSymbol` uses `qualifiedName.includes("Type::method")` |

## Languages Completed

- [x] **Go** — `getReceiverType` extracts receiver from `func (sl *Type) method()`
- [x] **Swift** — NOT needed. Tree-sitter parses `extension Type { }` as `class_declaration`, so methods already get owner type in `qualified_name` (e.g., `SimplifyApply.swift::SimplifyApply.swift::ApplyInst::simplify`)

## Languages To Do

Check these — only add `getReceiverType` if methods are top-level (not nested inside their owner type in the AST):

- [ ] Rust — methods in `impl Type { }` blocks
- [ ] C++ — out-of-class method definitions `Type::method()`
- [ ] Kotlin — extension functions `fun Type.method()`

Verify these DON'T need it (methods nested in class body → qualified name should already be correct):
- [ ] Python — verify `qualified_name` includes class name
- [ ] Java — verify `qualified_name` includes class name
- [ ] TypeScript — verify `qualified_name` includes class name
- [ ] C# — verify `qualified_name` includes class name
