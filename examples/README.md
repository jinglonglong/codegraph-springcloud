# Springgraph demo projects

> Runnable, single-purpose Spring Cloud projects you can `init -i` and open
> in the Web UI immediately — no JDK, no Maven, no Spring Boot install
> required. The point is to give you a real codebase so the AI Agent has
> something to query in 30 seconds.

If you just want to confirm the tool works, start here. Each demo is small
enough that the index finishes in under 5 seconds.

---

## `springcloud-demo` — the canonical one

A self-contained Spring Boot + Spring Cloud project that exercises every
annotation Springgraph knows about:

- 2 REST controllers (`@RestController`, `@GetMapping`, `@PostMapping`,
  `@RequestMapping`)
- 2 services (`@Service`, `@Transactional`)
- 2 MyBatis mappers — one with XML (`UserMapper.xml`), one with annotation
  SQL (`@Select`)
- 1 OpenFeign client (`@FeignClient(name="order-service")`)
- 1 `@Scheduled` cleanup job
- `application.yml` + `bootstrap.yml` with datasource, redis, and Nacos
  discovery
- ~15 source files, ~450 lines

### Run it

```bash
cd examples/springcloud-demo

# Index
npx @jinglonglong/springgraph init -i

# Open the Web UI
npx @jinglonglong/springgraph web
# -> browser opens at http://127.0.0.1:4000
```

You should see a populated graph with the 2 controllers, the 2 services,
the 2 mappers, the Feign client, the SQL XML files, and a labeled
`@Scheduled` task. Then try one of these questions against the AI Agent
(Claude Code / Cursor / OpenCode):

- *"GET /api/users 最后查了哪些表？"* — should trace Controller → Service
  → Mapper → XML SQL.
- *"OrderClient 调用了哪个服务？"* — should resolve the Feign client to
  `order-service` and the matching endpoint.
- *"如果我重命名 UserService.findAll，会影响哪些文件？"* — should walk
  callers, mapper XML, and the controller endpoint.

See [`springcloud-demo/README.md`](./springcloud-demo/README.md) for the
full MCP tool coverage matrix and the V1 acceptance criteria mapping.

---

## Adding your own

If you want a project to be picked up as a Springgraph demo:

1. Put it under `examples/<your-demo-name>/`.
2. Include a `README.md` with: a "Project Structure" tree, a "MCP Tool
   Coverage Matrix" (which tool on which input gives which result), and
   a "Running the Demo" code block.
3. Make sure `springgraph init -i` succeeds from the demo's root
   (`.springgraph/` is git-ignored, so the initial state is what
   reviewers see).
4. The demo should not need a real database / Nacos / Redis to be
   indexed — only to be *run*. The whole point is to give the indexer
   something to chew on without standing up a runtime.

---

## Why this exists

The #1 reason a new user gives up on Springgraph is "I opened the Web UI
and it's empty." Either they forgot `init -i`, or they did run it but
their project is the kind of brownfield monorepo where the indexer
quietly missed half the symbols. A demo is a *known-good input*: if the
graph is empty on this project, the tool is broken; if it's not, the
problem is on the user's side.

The other reason is honesty. A demo gives reviewers a thing to point
their AI Agent at, and the questions in the coverage matrix are the
ones the maintainers actually tested. That's the difference between
"AI can answer questions about my Spring Cloud project" and "AI can
answer *these specific questions* about *this specific project*."
