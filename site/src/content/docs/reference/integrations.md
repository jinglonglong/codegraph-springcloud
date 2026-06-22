---
title: 集成
description: 已支持的 Agent,以及手动配置 MCP 的方法。
---

交互式安装器会自动识别并配置每个受支持的 Agent——接入 MCP 服务器,并写入对应的指令文件。

## 受支持的 Agent

- **Claude Code**
- **Cursor**
- **Codex CLI**
- **opencode**
- **Hermes Agent**
- **Gemini CLI**
- **Antigravity IDE**
- **Kiro**

运行 `npx @jinglonglong/springgraph`,选择你要接入的 Agent 即可;非交互式参数见 [安装指南](/springgraph/getting-started/installation/)。

## 手动配置

如果你想自己手动接入,先全局安装:

```bash
npm install -g @jinglonglong/springgraph
```

在 `~/.claude.json` 中加入 MCP 服务器:

```json
{
  "mcpServers": {
    "springgraph": {
      "type": "stdio",
      "command": "springgraph",
      "args": ["serve", "--mcp"]
    }
  }
}
```

可选:在 `~/.claude/settings.json` 中预先放行只读工具:

```json
{
  "permissions": {
    "allow": [
      "mcp__springgraph__springgraph_search",
      "mcp__springgraph__springgraph_callers",
      "mcp__springgraph__springgraph_callees",
      "mcp__springgraph__springgraph_impact",
      "mcp__springgraph__springgraph_node",
      "mcp__springgraph__springgraph_status",
      "mcp__springgraph__springgraph_files"
    ]
  }
}
```

:::tip
Cursor 启动 MCP 子进程时的工作目录是错误的。安装器会自动注入 `--path` 参数帮你处理;如果你手动配置 Cursor,请显式传入项目路径。
:::
