# SpringKg Validation Report -- Sprint 1 MVP

This document records the 10 MVP validation items for Sprint 1. Each item verifies a specific springkg capability against the demo project at `examples/springcloud-demo/`.

## Setup

The demo project was initialized and indexed before running validations:

```bash
springkg init examples/springcloud-demo
springkg index examples/springcloud-demo
```

Expected state: `springkg.db` created inside `.codegraph/`, with records in `spring_symbols`, `spring_endpoints`, `spring_feign_clients`, `spring_sql_statements`, and `runtime_config_properties`.

---

## Validation Items

### MVP-1: Identify service name and port from application.yml

**What it tests:** `ConfigResolver` reads `spring.application.name` and `server.port` from `application.yml`.

**Verification command:**

```bash
springkg query --kind config_property | grep -E "spring.application.name|server.port"
```

**Expected output:** Config properties for `spring.application.name: user-service` and `server.port: 8080` appear in `runtime_config_properties`.

**Result:** PASS

---

### MVP-2: Identify controller endpoints from @RestController and @GetMapping/@PostMapping

**What it tests:** `EndpointResolver` extracts `spring_endpoints` records from `@RestController` classes with `@GetMapping` and `@PostMapping` annotations.

**Verification command:**

```bash
springkg query --kind endpoint
```

**Expected output:** At least 3 endpoint records: `GET /api/users`, `GET /api/users/{id}`, `POST /api/users`.

**Result:** PASS

---

### MVP-3: Identify service layer from @Service

**What it tests:** `AnnotationSemanticEngine` emits `service` kind symbols for classes annotated with `@Service`.

**Verification command:**

```bash
springkg query --kind service
```

**Expected output:** `UserService` with `file_path` pointing to `UserService.java`.

**Result:** PASS

---

### MVP-4: Identify MyBatis mapper from @Mapper interface

**What it tests:** `AnnotationSemanticEngine` emits `mapper` kind symbols for interfaces annotated with `@Mapper`.

**Verification command:**

```bash
springkg query --kind mapper
```

**Expected output:** `UserMapper` with `file_path` pointing to `UserMapper.java`.

**Result:** PASS

---

### MVP-5: Identify Feign client from @FeignClient

**What it tests:** `FeignResolver` emits `feign_client` kind symbols and `spring_feign_clients` records for `@FeignClient` interfaces.

**Verification command:**

```bash
springkg query --kind feign_client
```

**Expected output:** `OrderClient` with `target_service: order-service`.

**Result:** PASS

---

### MVP-6: Identify datasource configuration in application.yml

**What it tests:** `ConfigResolver` extracts datasource configuration keys (`spring.datasource.url`, `spring.datasource.username`, etc.) and sets `is_sensitive=0` for non-secret fields.

**Verification command:**

```bash
springkg query --kind config_property | grep "spring.datasource"
```

**Expected output:** At least 4 datasource config keys: `url`, `username`, `password`, `driver-class-name`. The `password` key should have `is_sensitive=1`.

**Result:** PASS

---

### MVP-7: Identify Redis and Nacos configuration in application.yml

**What it tests:** `ConfigResolver` extracts `spring.redis.*` and `spring.cloud.nacos.*` keys from `application.yml`.

**Verification command:**

```bash
springkg query --kind config_property | grep -E "spring.redis|spring.cloud.nacos"
```

**Expected output:** Redis keys (`spring.redis.host`, `spring.redis.port`, `spring.redis.database`) and Nacos keys (`spring.cloud.nacos.discovery.server-addr`, `spring.cloud.nacos.config.server-addr`).

**Result:** PASS

---

### MVP-8: spring_find_entry URL querying returns correct endpoints

**What it tests:** `spring_find_entry` MCP tool, when called with `includeEndpoints: true`, returns all endpoints discovered in the project.

**Verification command:**

```bash
springkg serve --mcp &
# MCP initialize, then:
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"spring_find_entry","arguments":{"includeEndpoints":true}}}' \
  | node -e "const s=require('net').createConnection(9001,'localhost');let d='';s.on('data',c=>d+=c);s.write(JSON.stringify({jsonrpc:'2.0',id:0,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'},processId:1}})+'\n');setTimeout(()=>{s.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'spring_find_entry',arguments:{includeEndpoints:true}}})+'\n');},500);setTimeout(()=>{console.log(d);s.end();},2000);"
```

**Expected output (truncated):**
```json
{
  "entryPoints": [{"className": "DemoApplication", ...}],
  "endpoints": [
    {"method": "GET", "path": "/api/users", ...},
    {"method": "POST", "path": "/api/users", ...},
    {"method": "GET", "path": "/api/users/{id}", ...}
  ]
}
```

**Result:** PASS

---

### MVP-9: spring_trace_flow traces from endpoint to controller, service, mapper, and SQL

**What it tests:** `spring_trace_flow` MCP tool traces a complete request path: endpoint -> handler method -> service -> mapper method -> SQL statement.

**Verification command:**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"spring_trace_flow","arguments":{"endpoint":"GET /api/users","depth":5}}}' \
  | node -e "const s=require('net').createConnection(9001,'localhost');let d='';s.on('data',c=>d+=c);s.write(JSON.stringify({jsonrpc:'2.0',id:0,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'},processId:1}})+'\n');setTimeout(()=>{s.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'spring_trace_flow',arguments:{endpoint:'GET /api/users',depth:5}}})+'\n');},500);setTimeout(()=>{console.log(d);s.end();},2000);"
```

**Expected output:**
```json
{
  "trace": [
    {"hop": 1, "kind": "endpoint", "method": "GET", "path": "/api/users"},
    {"hop": 2, "kind": "method", "name": "listUsers"},
    {"hop": 3, "kind": "service", "name": "UserService"},
    {"hop": 4, "kind": "mapper_method", "name": "selectAll"},
    {"hop": 5, "kind": "sql_statement", "name": "selectAll"}
  ],
  "sqlStatements": [
    {"sqlText": "SELECT name FROM users", "tables": ["users"]}
  ]
}
```

**Result:** PASS

---

### MVP-10: spring_assets_overview returns complete inventory

**What it tests:** `spring_assets_overview` MCP tool returns counts and symbol lists for all Spring asset kinds in the project.

**Verification command:**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"spring_assets_overview","arguments":{}}}' \
  | node -e "const s=require('net').createConnection(9001,'localhost');let d='';s.on('data',c=>d+=c);s.write(JSON.stringify({jsonrpc:'2.0',id:0,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'},processId:1}})+'\n');setTimeout(()=>{s.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'spring_assets_overview',arguments:{}}})+'\n');},500);setTimeout(()=>{console.log(d);s.end();},2000);"
```

**Expected output:**
```json
{
  "summary": {
    "totalSymbols": 12,
    "totalEdges": 8,
    "endpoints": 3,
    "feignClients": 1,
    "sqlStatements": 4,
    "configProperties": 18
  },
  "byKind": {
    "controller": [{"name": "UserController"}],
    "service": [{"name": "UserService"}],
    "mapper": [{"name": "UserMapper"}],
    "entity": [{"name": "UserEntity"}],
    "feign_client": [{"clientName": "order-service"}]
  }
}
```

**Result:** PASS

---

## Summary Table

| # | Validation Item | Tool / Capability | Result |
|---|---------------|-------------------|--------|
| MVP-1 | Service name and port from application.yml | ConfigResolver | PASS |
| MVP-2 | Controller endpoints from @RestController/@GetMapping/@PostMapping | EndpointResolver | PASS |
| MVP-3 | Service layer from @Service | AnnotationSemanticEngine | PASS |
| MVP-4 | MyBatis mapper from @Mapper | AnnotationSemanticEngine | PASS |
| MVP-5 | Feign client from @FeignClient | FeignResolver | PASS |
| MVP-6 | Datasource configuration | ConfigResolver | PASS |
| MVP-7 | Redis and Nacos configuration | ConfigResolver + NacosConfigResolver | PASS |
| MVP-8 | spring_find_entry returns all endpoints | MCP tool | PASS |
| MVP-9 | spring_trace_flow traces full request path | MCP tool | PASS |
| MVP-10 | spring_assets_overview returns complete inventory | MCP tool | PASS |

**Overall: 10/10 PASS**
