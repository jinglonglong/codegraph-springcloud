---
title: 知识图谱
description: 图谱由哪些节点类型与边类型构成。
---

Springgraph 持久化三样东西：**节点**（符号与文件）、**边**（符号之间的关系），以及**文件**本身。每个节点和边都带一个精确的 `kind`，取自固定词表，保证跨语言查询的结果是一致的。

## 节点类型

`file`、`module`、`class`、`struct`、`interface`、`trait`、`protocol`、`function`、`method`、`property`、`field`、`variable`、`constant`、`enum`、`enum_member`、`type_alias`、`namespace`、`parameter`、`import`、`export`、`route`、`component`。

## 边类型

`contains`、`calls`、`imports`、`exports`、`extends`、`implements`、`references`、`type_of`、`returns`、`instantiates`、`overrides`、`decorates`。

## 边的来源

绝大部分边直接来自 AST。还有少数处于静态解析跟不到的动态分发边界，会被**合成**出来，并标记为 `provenance: 'heuristic'`，同时附上创建它们的连接点位置。这些合成边会在 `explore` 与 `node` 的输出里就地展示，Agent 可以看清每条连接的来历。

## 如何查询

- **搜索**：按名称搜索符号（基于 FTS5）。
- **调用方 / 被调方**：沿调用图一次一跳地遍历。
- **影响面**：计算一次变更会波及的传递半径。
- **Explore**：一次调用返回多个相关符号的源码，按文件分组，并给出它们之间的调用路径。

具体调用方式参见 [CLI](/springgraph/reference/cli/) 与 [MCP 服务器](/springgraph/reference/mcp-server/) 参考。