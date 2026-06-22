---
title: 解析与框架
description: Springgraph 如何把引用落地，以及如何把路由挂到对应的处理器。
---

抽取只产出节点和原始的边，**解析**负责把名字变成真正的连接。

## 引用解析

抽取完成之后，Springgraph 会处理以下关系：

- **导入** → 指向的源文件（含 tsconfig 路径别名与 cargo 工作区成员）。
- **调用** → 通过导入解析与名字匹配，定位到定义。
- **继承** → 类型之间的 `extends` / `implements` 关系。

## 框架识别

Springgraph 识别 Web 框架的路由文件，产出 `route` 节点，并通过 `references` 边挂到对应的处理器类或函数上。这样查一个视图或控制器的调用方时，与之绑定的 URL 模式也会一起浮现。完整支持框架列表见 [框架路由](/springgraph/guides/framework-routes/)。

## 动态分发覆盖

静态解析拿不到计算出来的或间接的调用，调用流会在动态分发处断掉。Springgraph 通过若干合成器桥接这些边界，让调用流端到端连通：

- 回调 / 观察者注册
- `EventEmitter` 通道
- React 重渲染（`setState` → `render`）
- JSX 子组件（`render` → 子组件）
- Django ORM 描述符

每条合成边都标记为 `provenance: 'heuristic'`，并带上连接点位置，在任何穿越它们的路径上都会就地显示。

## Spring 框架解析（本仓库相对标准 codegraph 的核心增量）

在通用 codegraph 的静态 AST 抽取之上，本仓库专为 Spring Boot / Spring Cloud 微服务新增了 Bean 装配与运行时派发解析。这些边让 Agent 能直接回答"这个 Controller 调用了哪个 Service 实现"、"这条 SQL 由哪个方法触发"这类架构问题，不再需要回退到 Read / Grep。下面三类能力是相对标准 codegraph 的关键补充。

### Spring Bean 自动装配与构造器注入

`@Autowired`、`@Resource` 字段注入，以及构造器注入（包括 Lombok `@RequiredArgsConstructor` 生成的隐式构造器），都会被解析为从注入点到 Bean 实现的边。接口到实现的派发按 Bean 类型与 Bean 名称匹配——这套逻辑基于 Spring 容器语义，而不是纯类型推断。

通过这些边，Agent 可以从 Controller 的字段直接走到具体的 Service 实现，不用再去猜"到底注入了哪个 bean"。

### OpenFeign 客户端派发

`@FeignClient` 注解的接口被识别为远程调用入口，并连接到目标服务的 Controller。沿这条边，Agent 能从调用方直接跳到被调方的端点方法，跳过运行时 URL 推断这层模糊地带。

### MyBatis XML Mapper 链路

MyBatis 的 Java `Mapper` 接口与同包下的 `*Mapper.xml` 通过 namespace + id 关联起来：接口方法 → 对应 XML 的 `<select|insert|update|delete>` 节点 → 再进一步把 SQL 语句本身抽取为符号节点。Agent 因此不仅能跟踪 Mapper 调用，还能直接看到该调用触发的 SQL 文本，便于排查"这次请求到底跑了什么语句"。