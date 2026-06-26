# Repository Info

> Repository metadata snapshot. Keep this in sync with the values set on
> GitHub (Settings → General → "About" / Topics) and on npmjs.com.

## Project

| Field | Value |
|---|---|
| Name | Springgraph |
| npm package | `@jinglonglong/springgraph` |
| Tagline (EN) | Spring Cloud code knowledge graph and MCP server for AI coding agents |
| Tagline (CN) | 为 Spring Cloud 微服务打造的代码知识图谱 · AI 协同引擎 |
| Short pitch (EN) | Springgraph helps AI coding agents understand large Spring Cloud projects locally. |
| Short pitch (CN) | Springgraph 让 AI 编程助手在本地理解大型 Spring Cloud 项目。 |

## Links

| Field | Value |
|---|---|
| Repository | https://github.com/jinglonglong/springgraph |
| Documentation site | https://jinglonglong.github.io/springgraph/ |
| Issue tracker | https://github.com/jinglonglong/springgraph/issues |
| npm | https://www.npmjs.com/package/@jinglonglong/springgraph |
| Author email | xyjinglong@163.com |
| License | MIT |

## GitHub "About" panel (Settings → General)

Set the following values via the GitHub web UI or the REST API
(`PATCH /repos/jinglonglong/springgraph`):

- **Description**: `Spring Cloud code knowledge graph and MCP server for AI coding agents`
- **Website**: `https://jinglonglong.github.io/springgraph/`

## Topics (Settings → General → Topics)

GitHub allows up to 20 repository topics. The canonical list:

```
spring-cloud
spring-boot
java
mybatis
mcp
mcp-server
ai-agent
claude-code
cursor
opencode
code-analysis
knowledge-graph
static-analysis
microservices
developer-tools
architecture
call-graph
code-intelligence
```

To update via the API:

```bash
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.mercy-preview+json" \
  https://api.github.com/repos/jinglonglong/springgraph/topics \
  -d '{"names":["spring-cloud","spring-boot","java","mybatis","mcp","mcp-server","ai-agent","claude-code","cursor","opencode","code-analysis","knowledge-graph","static-analysis","microservices","developer-tools","architecture","call-graph","code-intelligence"]}'
```

## Fork lineage

This project is a second-generation fork of
[colbymchenry/codegraph](https://github.com/colbymchenry/codegraph).
Springgraph adds the Spring Boot / Spring Cloud semantic layer and the
architecture-profile engine on top of codegraph's general-purpose graph
infrastructure.
