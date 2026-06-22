---
title: 工作原理
description: 抽取、存储、解析与自动同步的完整流水线。
---

Springgraph 把源代码变成一张可查询的图，整个过程分四个阶段。

```
files → Extraction (tree-sitter) → DB (nodes/edges/files)
            ↓
      Resolution (imports, name-matching, framework patterns)
            ↓
      Graph queries (callers, callees, impact)
            ↓
      Context building (markdown / JSON for AI consumption)
```

## 1. 抽取

[tree-sitter](https://tree-sitter.github.io/) 把源码解析成 AST。针对每种语言编写的查询语句从中提取**节点**（函数、类、方法、类型等）与**边**（调用、导入、继承、实现）。重计算任务被剥离到主线程之外执行。

## 2. 存储

所有内容都写进本地 SQLite 数据库（`.springgraph/springgraph.db`），内置 FTS5 全文索引。Springgraph 在原生 `better-sqlite3` 可用时优先使用，缺失时透明回退到 WASM 后端；运行 `springgraph status` 能看到当前激活的是哪一个。

## 3. 解析

抽取只产出了节点和原始的边，解析阶段负责把它们落地：函数调用 → 真正的定义，导入 → 源文件，类之间的继承关系，还有各类框架特有的模式。一些动态分发的边界（回调、观察者、React 重渲染、JSX 子组件）由合成器桥接，让调用流能端到端连通。详见 [解析与框架](/springgraph/core-concepts/resolution/)。

## 4. 自动同步

MCP 服务器基于操作系统原生文件事件（FSEvents / inotify / ReadDirectoryChangesW）监听项目。事件先做防抖，再过滤出源代码文件，最后增量同步回数据库。无需任何配置，图谱跟着编码过程持续保鲜。