---
title: 故障排查
description: 最常见的 Springgraph 问题的修复方法。
---

## "Springgraph 未初始化"

先在项目目录下运行 `springgraph init`。

## 索引很慢

确认 `node_modules` 等大目录被排除(被 `.gitignore` 忽略的目录会自动排除)。用 `--quiet` 可以减少输出开销。

## MCP 报 `database is locked`

当前版本不应该出现:Springgraph 自带 Node 运行时,并使用 Node 内置的 `node:sqlite`,在 WAL 模式下并发读不会被写阻塞。如果你还是遇到:

- **你装的是旧的(0.9 之前的)版本。** 重新安装以获得自带运行时——`curl -fsSL https://raw.githubusercontent.com/jinglonglong/springgraph/master/install.sh | sh`(macOS/Linux),`irm https://raw.githubusercontent.com/jinglonglong/springgraph/master/install.ps1 | iex`(Windows),或 `npm i -g @jinglonglong/springgraph@latest`。
- **`springgraph status` 显示的 `Journal:` 不是 `wal`** —— 在当前文件系统上无法启用 WAL(常见于网络共享盘和 WSL2 的 `/mnt` 下),此时读会被写阻塞。把项目(连同其 `.springgraph/` 目录)挪到本地磁盘上。

## MCP 服务器连不上

确认项目已经初始化并建好索引,核对 MCP 配置里的路径,并检查命令行下 `springgraph serve --mcp` 能正常启动。

## 符号缺失

MCP 服务器会在文件保存后自动同步(等几秒钟)。必要时也可以手动运行 `springgraph sync`。检查文件的语言是否在 [支持列表](/springgraph/reference/languages/) 中,且没有被 `.gitignore` 排除。
