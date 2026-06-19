# Team Coordination

> This file is maintained by Team G. Teams A–F append status updates to their own sections.

---

## Team A — Foundation / CodeGraph Integration

**Status**: ✅ Phase 1 + Phase 2 complete (all 15 tasks)

### Deliverables

| Package | Purpose | Ready for |
|---|---|---|
| `@colbymchenry/springkg-shared` | TypeScript interfaces (`Resolver`, `SpringKgNode`, `SpringKgEdge`, `SPRINGKG_CONFIG`) | Teams B/C/D/F import from here |
| `@colbymchenry/springkg-core` | `SpringKg` orchestrator, `SpringDatabase`, migration runner, `SummaryGenerator` | Teams B/C/D/F register resolvers here |
| `@colbymchenry/springkg-installer` | `springkg install` / `springkg uninstall` CLI for Claude/Cursor/opencode | Team E extends with real implementations |
| `@colbymchenry/springkg-cli` | CLI binary (`springkg` command) | Team E adds `init`/`index`/`status` commands |

### How to register a resolver

```typescript
import { SpringKg } from '@colbymchenry/springkg-core';
import type { Resolver } from '@colbymchenry/springkg-shared';

const sk = await SpringKg.init({ projectPath: '/path/to/project' });
sk.registerResolver({
  name: 'my-resolver',
  emitsKinds: ['controller', 'service'],
  enhance: async (input) => {
    // input.codegraphNodes, input.codegraphEdges, input.changedFiles, input.cg
    return { symbolsAdded: 5, edgesAdded: 3, byKind: { controller: 2, service: 3 } };
  },
});
```

### Key files

- Resolver contract: `packages/springkg-shared/src/index.ts` (interfaces: `Resolver`, `SpringKgEnhanceInput`, `SpringKgEnhanceOutput`)
- Config + chain order: `SPRINGKG_CONFIG.resolverChain` in `packages/springkg-shared/src/index.ts`
- DB schema: `packages/springkg-core/src/db/schema.sql` (8 tables, confidence columns)
- Orchestrator: `packages/springkg-core/src/spring-kg.ts` (`SpringKg.init/open/registerResolver/enhanceOnSync`)

### Resolver execution order (SPRINGKG_CONFIG.resolverChain)

1. **Team B (semantic)**: `annotation-engine` → `endpoint-resolver` → `feign-resolver` → `feign-provider-bridge` → `feign-request-response-type`
2. **Team D (runtime)**: `config-resolver` → `middleware-inventory` → `nacos-config-resolver` → `config-property-usage-tracker` → `gateway-route-resolver`
3. **Team C (data)**: `mybatis-xml-extractor` → `annotation-sql-extractor` → `sql-table-column` → `mapper-binding` → `mybatis-plus`
4. **Team F (community)**: `community-builder`

### Stage isolation

- If ALL resolvers in a stage fail, subsequent stages are SKIPPED.
- If a single resolver within a stage fails, siblings continue normally.

### Tests

- 8 tests passing, 1 skipped (Windows-gated) — `npx vitest run __tests__/team-a/`

### Tag

- `v0.1.0-springkg-foundation` on commit `ce059a0` (main branch)

## Team C — Data Access / MyBatis / SQL

**Status**: ✅ Sprint 2 implementation complete

### Tasks completed (T25–T31)

| Task | Status | Notes |
|---|---|---|
| T25 MyBatisXmlExtractor | ✅ Done | XML enhancement with include expansion, resultMap, dynamic SQL, cycle detection |
| T26 AnnotationSqlExtractor | ✅ Done | @Select/@Insert/@Update/@Delete/@SelectProvider annotation parsing |
| T27 SqlTableColumnExtractor | ✅ Done | SQL table/column extraction with dynamic tag confidence scoring |
| T28 SqlWriter | ✅ Done | Write to springkg.db with idempotent INSERT OR REPLACE |
| T29 MapperBindingResolver | ✅ Done | Binds Java Mapper interfaces to XML statements via BIND_TO edges |
| T30 MyBatisPlusResolver | ✅ Done | @TableName, @TableId, @TableField entity resolution with snake_case convention |
| T31 JPAEntityResolver | ✅ Done | @Entity, @Table JPA entity to table mapping |
| Index export | ✅ Done | All modules exported from `packages/springkg-data/src/index.ts` |

### Tests

- 27 tests, all passing (`npx vitest run packages/springkg-data`)
- 7 test files covering all 7 modules

### Schema amendment requests

None — Team A's schema already covered the required columns (`mapper_namespace`, `statement_id`, `operation`, `sql_preview`, `xml_path`).

### Open questions for Team E

1. Should `spring_find_mapper` filter on `kind='mapper'` or `kind='class'` with `@Mapper` decorator?
2. How should annotation-only Mapper methods (without XML binding) appear in `spring_find_mapper` output?
3. Is the `sql_statement.codegraphNodeId` field used by Team E's MCP tools, or can it be a placeholder?

### Merge order

Team C ships in one PR (T25–T31 together) since all modules are independent and Team E can start T33/T34 once this lands.
