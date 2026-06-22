---
title: 你的第一个图谱
description: 构建索引并对它运行第一次查询。
---

装好 Springgraph 之后,构建并探索图谱只需要三条命令。

## 给项目建索引

```bash
cd your-project
springgraph init -i      # 一步完成初始化 + 建索引
```

`init` 会创建 `.springgraph/` 目录;`-i`(或 `--index`)立刻构建完整的索引。对于已有项目,你可以随时重新建索引:

```bash
springgraph index          # 全量建索引
springgraph sync           # 增量更新变更的文件
```

## 验证是否成功

```bash
springgraph status
```

这一步会输出节点 / 边 / 文件数量、当前激活的 SQLite 后端以及 journal 模式,用来快速检查索引是否就绪。

## 运行一次查询

```bash
springgraph query UserService          # 按名字查找符号
springgraph callers handleRequest      # 谁调用了这个函数
springgraph callees handleRequest      # 这个函数调用了谁
springgraph impact AuthMiddleware      # 改动会影响哪些地方
springgraph context "fix the login flow"   # 围绕任务构建上下文
```

每个命令都支持 `--json` 来输出机器可读的结果。完整说明见 [CLI 参考](/springgraph/reference/cli/)。

## 把它交给你的 agent

只要 `.springgraph/` 目录存在,并且 agent 已配置(见 [安装](/springgraph/getting-started/installation/)),你的 agent 就会自动使用 [MCP 工具](/springgraph/reference/mcp-server/),无需额外步骤。
