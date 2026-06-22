---
title: 快速开始
description: 几秒钟内启动并运行 Springgraph。
---

几秒钟内启动并运行 Springgraph。

## 第 1 步:安装 Springgraph

推荐通过 npm 全局安装(需要 Node.js >= 18):

```bash
npm install -g @jinglonglong/springgraph
```

或者使用 `npx` 免安装直接运行:

```bash
npx @jinglonglong/springgraph
```

不想装 Node.js?可以用一键脚本自动下载适合你系统的二进制:

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/jinglonglong/springgraph/master/install.sh | sh
```

```bash
# Windows (PowerShell)
irm https://raw.githubusercontent.com/jinglonglong/springgraph/master/install.ps1 | iex
```

Springgraph 自带运行时,无需编译,没有本地构建,跨平台一致。

## 第 2 步:为你的 AI Agent 启用 MCP

通过 `springgraph install` 命令,自动检测并配置所有已安装的 AI Agent(Claude Code、Cursor、Codex CLI、opencode、Hermes Agent、Gemini CLI、Antigravity IDE、Kiro),并把 MCP 服务注册到它们的配置中。

交互式运行(自动检测 agent,逐个提示选择):

```bash
springgraph install
```

一键非交互式安装(全局、自动检测 agent、开启自动授权,推荐用于 CI 或自动配置):

```bash
springgraph install -y
```

只安装到指定的 agent(逗号分隔):

```bash
springgraph install --target=claude,cursor --yes
```

安装到当前项目(`.mcp.json` / `.cursor/rules/` 等),而不是全局用户目录:

```bash
springgraph install --location=local --yes
```

**支持的 Agent 与配置文件位置**:`springgraph install` 会根据 `agent` 名称,把 `springgraph serve --mcp` 注入到对应配置文件,同时在 `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` / `.cursor/rules/springgraph.mdc` 等指令文件里写入 `SPRINGGRAPH_START` 区块。详见 [安装指南](/springgraph/getting-started/installation/)。

## 第 3 步:初始化项目

进入你要分析的项目目录,运行一次 `init` 即可建立 `.springgraph/` 索引。

```bash
cd your-project
springgraph init -i
```

就这些。只要 `.springgraph/` 索引存在,你配置的 AI Agent 就会自动加载 MCP 服务并启用 `springgraph_*` 工具。

下一步:构建[你的第一个图谱](/springgraph/getting-started/your-first-graph/),或者查看完整的[安装](/springgraph/getting-started/installation/)选项。
