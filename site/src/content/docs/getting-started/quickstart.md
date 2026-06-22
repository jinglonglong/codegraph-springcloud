---
title: 快速开始
description: 几秒钟内启动并运行 Springgraph。
---

几秒钟内启动并运行 Springgraph。

## 推荐方式:通过 npm 全局安装

```bash
# 全局安装(推荐,需要 Node.js >= 18)
npm install -g @jinglonglong/springgraph

# 或者使用 npx 免安装运行
npx @jinglonglong/springgraph
```

Springgraph 自带运行时,无需编译,没有本地构建,跨平台一致。交互式安装器会自动配置你的 agent:Claude Code、Cursor、Codex CLI、opencode、Hermes Agent、Gemini CLI、Antigravity IDE、Kiro。

## 不想装 Node.js?一键脚本(自动下载适合你系统的二进制)

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/jinglonglong/springgraph/master/install.sh | sh

# Windows (PowerShell)
irm https://raw.githubusercontent.com/jinglonglong/springgraph/master/install.ps1 | iex
```

## 初始化项目

```bash
cd your-project
springgraph init -i
```

就这些,只要 `.springgraph/` 目录存在,你的 agent 会自动使用 Springgraph 工具。

下一步:构建[你的第一个图谱](/springgraph/getting-started/your-first-graph/),或者查看完整的[安装](/springgraph/getting-started/installation/)选项。
