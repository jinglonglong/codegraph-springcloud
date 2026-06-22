---
title: 安装
description: 安装 Springgraph 并配置你的 AI 编码 agent。
---

## 1. 运行安装器

推荐方式:通过 npm 全局安装 `springgraph`,然后运行安装器。

```bash
# 全局安装 springgraph(推荐)
npm install -g @jinglonglong/springgraph

# 然后运行安装器
springgraph
```

如果你不想安装 Node.js,也可以直接用 npx 运行安装器(免安装):

```bash
npx @jinglonglong/springgraph
```

安装器会:

- 询问要配置哪些 agent。会自动检测已安装的 **Claude Code**、**Cursor**、**Codex CLI**、**opencode**、**Hermes Agent**、**Gemini CLI**、**Antigravity IDE** 和 **Kiro**。
- 询问是否将 `springgraph` 加入 `PATH`(这样 agent 才能启动 MCP 服务器)。
- 询问配置是应用到所有项目还是仅当前项目。
- 写入每个已选 agent 的 MCP 服务器配置以及说明文件(例如 `CLAUDE.md`、`.cursor/rules/springgraph.mdc`、`~/.codex/AGENTS.md`)。
- 当目标包含 Claude Code 时,设置自动允许权限。
- 初始化当前项目(仅本地安装生效)。

## 非交互模式(脚本化 / CI)

```bash
springgraph install --yes                              # 自动检测 agent,全局安装
springgraph install --target=cursor,claude --yes       # 明确指定 agent 列表
springgraph install --target=auto --location=local     # 自动检测,项目本地安装
springgraph install --print-config codex               # 打印配置片段,不写文件
```

| 参数 | 取值 | 默认行为 |
|---|---|---|
| `--target` | `auto`, `all`, `none`, 或逗号分隔列表(`claude,cursor,…`) | 询问 |
| `--location` | `global`, `local` | 询问 |
| `--yes` | (boolean) | 每一步都询问 |
| `--no-permissions` | (boolean) 跳过 Claude 自动允许列表 | 启用权限 |
| `--print-config <id>` | 输出某个 agent 的配置片段后退出 | 无 |

## 2. 重启你的 agent

重启 agent (Claude Code / Cursor / Codex CLI / opencode / Hermes Agent / Gemini CLI / Antigravity IDE / Kiro),让 MCP 服务器加载。

## 3. 初始化项目

```bash
cd your-project
springgraph init -i
```

这一步会构建项目专属的知识图谱索引,并接入任何项目本地的 agent 接口,这样一次全局 `springgraph install` 就能在你打开的每个项目中工作。

## 支持的平台

每次发布都会为三大桌面操作系统打包自包含的构建(已绑定 Node 运行时,无需编译),同时支持 x64 和 arm64:

| 平台 | 架构 | 安装方式 |
|---|---|---|
| Windows | x64, arm64 | PowerShell 安装器 或 npm |
| macOS | x64, arm64 | shell 安装器 或 npm |
| Linux | x64, arm64 | shell 安装器 或 npm |

## 卸载

改主意了?一条命令就能把 Springgraph 从所有已配置的 agent 中移除:

```bash
springgraph uninstall
```

这一步会反向执行安装器,从每个已配置的 agent 上剥离 Springgraph 的 MCP 服务器配置、说明文件和权限。你的项目索引(`.springgraph/`)会保留不动;如需删除,可在每个项目中运行 `springgraph uninit`。使用 `--target` 指定要移除的 agent,或使用 `--yes` 进入非交互模式。
