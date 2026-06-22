---
title: 框架路由识别
description: Springgraph 将 URL 模式与对应的处理函数/类关联起来。
---

Springgraph 会识别各类 Web 框架的路由文件,并生成与对应处理类或处理函数相连的 `route` 节点(通过 `references` 边)。查询某个视图或控制器的调用方时,即可看到绑定到它的 URL 模式。

| 框架 | 识别的路由形态 |
|---|---|
| **Django** | `urls.py` 中的 `path()`、`re_path()`、`url()`、`include()`(CBV `.as_view()`、点号路径) |
| **Flask** | `@app.route('/path', methods=[…])`、蓝图路由 |
| **FastAPI** | `@app.get(…)`、`@router.post(…)` 等所有标准方法 |
| **Express** | `app.get(…)`、`router.post(…)` 及其中间件链 |
| **NestJS** | `@Controller` + `@Get/@Post/…`,GraphQL 解析器,消息/事件模式,WebSocket 订阅 |
| **Laravel** | `Route::get()`、`Route::resource()`、`Controller@action`、元组语法 |
| **Drupal** | `*.routing.yml` 路由;`.module`/`.theme`/`.install`/`.inc` 中的 `hook_*` 实现 |
| **Rails** | `get '/x', to: 'users#index'`,hash-rocket 语法 |
| **Spring** | 方法上的 `@GetMapping`、`@PostMapping`、`@RequestMapping` |
| **Gin / chi / gorilla / mux** | `r.GET(…)`、`router.HandleFunc(…)` |
| **Axum / actix / Rocket** | `.route("/x", get(handler))` |
| **ASP.NET** | Action 方法上的 `[HttpGet("/x")]` 特性 |
| **Vapor** | `app.get("x", use: handler)` |
| **React Router** / **SvelteKit** | 路由组件节点 |

路由解析是自动完成的,无需任何额外配置。只要一个框架文件被识别出来,它的路由就会在下一次索引或同步后出现在知识图谱中。

## Spring Cloud / Spring Boot Web 路由示例

Spring Cloud 项目里,HTTP 入口通常由 `@RestController` 与 `@RequestMapping`(以及它的衍生注解 `@GetMapping`、`@PostMapping` 等)定义;服务之间的远程调用则由 `@FeignClient` 声明。下面给出 Springgraph 能够识别的典型形态,以及对应的处理函数 / 远程客户端在图中如何被关联。

### `@RestController` + `@RequestMapping` 端点

类级别的 `@RequestMapping` 会被提取为路由前缀,方法级别的 `@RequestMapping` / `@GetMapping` / `@PostMapping` / `@PutMapping` / `@DeleteMapping` / `@PatchMapping` 则会与具体的处理函数绑定。每条路由都会生成一个 `route` 节点,通过 `references` 边指向对应的 controller 方法。

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping
    public List<UserDTO> list() {
        return userService.listAll();
    }

    @GetMapping("/{id}")
    public UserDTO getOne(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PostMapping
    public UserDTO create(@RequestBody @Valid UserCreateRequest req) {
        return userService.create(req);
    }

    @PutMapping("/{id}")
    public UserDTO update(@PathVariable Long id, @RequestBody @Valid UserUpdateRequest req) {
        return userService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }
}
```

Springgraph 会为这段代码生成如下路由节点(均挂载在 `UserController` 类节点下):

| HTTP 方法 | 路由模式 | 对应方法 | 备注 |
|---|---|---|---|
| `GET` | `/api/v1/users` | `UserController.list()` | 类级别 `@RequestMapping` 拼方法级别 `@GetMapping` |
| `GET` | `/api/v1/users/{id}` | `UserController.getOne(Long)` | `@PathVariable` 占位 |
| `POST` | `/api/v1/users` | `UserController.create(UserCreateRequest)` | `@RequestBody` 入参 |
| `PUT` | `/api/v1/users/{id}` | `UserController.update(Long, UserUpdateRequest)` | |
| `DELETE` | `/api/v1/users/{id}` | `UserController.delete(Long)` | |

### 类级别 + 方法级别的组合

方法级别注解缺省路径时,会自动继承类级别的 `@RequestMapping` 前缀。Springgraph 在生成 `route` 节点的 `path` 字段时会把两层路径正确拼起来。

```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    @GetMapping                 // → GET /api/v1/orders
    public List<OrderDTO> list() { ... }

    @GetMapping("/")            // → GET /api/v1/orders/
    public List<OrderDTO> listWithSlash() { ... }

    @GetMapping("/{orderId}")   // → GET /api/v1/orders/{orderId}
    public OrderDTO get(@PathVariable Long orderId) { ... }
}
```

### `@RequestMapping` 直接写在方法上

当方法上没有 `@RequestMapping` 的衍生注解,而是直接使用 `@RequestMapping` 时,Springgraph 会从 `method` 元素(可选)与 `value` / `path` 元素中识别路由信息。

```java
@RestController
public class LegacyController {

    @RequestMapping(value = "/api/v1/legacy/list", method = RequestMethod.GET)
    public List<ItemDTO> list() { ... }

    @RequestMapping(value = "/api/v1/legacy/{id}", method = { RequestMethod.PUT, RequestMethod.PATCH })
    public ItemDTO update(@PathVariable Long id, @RequestBody ItemDTO req) { ... }
}
```

`@RequestMapping` 中 `produces` / `consumes` 等内容协商属性会被一并记录到 `route` 节点的 metadata 里,方便后续按 Content-Type 过滤路由。

### `@FeignClient` 远程调用映射

`@FeignClient` 声明的接口会被识别为一组远程路由。Springgraph 会从 `@FeignClient` 的 `name` / `value` 字段得到目标服务名,从方法级别的 `@RequestMapping` 衍生注解得到远端路径,生成与本地 controller 路由结构对称的 `route` 节点。

```java
@FeignClient(name = "user-service", path = "/api/v1/users")
public interface UserFeignClient {

    @GetMapping
    List<UserDTO> list();

    @GetMapping("/{id}")
    UserDTO getOne(@PathVariable("id") Long id);

    @PostMapping
    UserDTO create(@RequestBody UserCreateRequest req);

    @DeleteMapping("/{id}")
    void delete(@PathVariable("id") Long id);
}
```

对应的路由节点会带上服务名作为上下文,例如:

| HTTP 方法 | 路由模式 | 目标服务 | 调用方接口方法 |
|---|---|---|---|
| `GET` | `/api/v1/users` | `user-service` | `UserFeignClient.list()` |
| `GET` | `/api/v1/users/{id}` | `user-service` | `UserFeignClient.getOne(Long)` |
| `POST` | `/api/v1/users` | `user-service` | `UserFeignClient.create(UserCreateRequest)` |
| `DELETE` | `/api/v1/users/{id}` | `user-service` | `UserFeignClient.delete(Long)` |

### 不带 `path` 的 `@FeignClient`

如果 `@FeignClient` 没有在类级别声明公共前缀,所有路径都来自方法级别的注解,Springgraph 会照常提取并生成对应的 `route` 节点:

```java
@FeignClient(name = "order-service")
public interface OrderFeignClient {

    @GetMapping("/api/v1/orders")
    List<OrderDTO> list();

    @PostMapping("/api/v1/orders")
    OrderDTO create(@RequestBody OrderCreateRequest req);
}
```

### 在查询中如何使用

这些路由节点让 `spring_find_entry` / `spring_trace_flow` 这类 MCP 工具可以回答诸如"哪些端点会暴露 `/api/v1/users`?"、"`user-service` 提供了哪些 HTTP 接口?"之类的问题,而不必再去逐个打开 controller 文件。路由节点和 controller 方法节点之间的 `references` 边也会参与跨服务调用链的拼接:从调用方 controller 走到本地 service,再到 `@FeignClient` 接口方法,最终到达对端服务的对应端点。