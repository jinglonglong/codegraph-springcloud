---
title: 项目索引
description: 全量索引、增量同步与文件监听。
---

## 初始化并建索引

```bash
cd your-project
springgraph init -i      # 初始化 + 全量建索引
```

`init` 会创建 `.springgraph/` 目录;`-i` / `--index` 会立刻构建索引。如果只想初始化而不立刻建索引,可以省略该标志,稍后再手动执行 `springgraph index`。

## 全量 vs. 增量

```bash
springgraph index           # 对整个项目执行全量索引
springgraph index --force   # 强制从头重建索引
springgraph sync            # 增量同步 —— 仅处理已变更的文件
```

`sync` 速度很快,因为它只会重新解析发生变化的文件。切换分支或批量编辑后,推荐使用 `sync`。

## 自动保持最新

**在 agent 会话期间,你不需要手动运行 `springgraph sync`。** 当你的 agent(Claude Code、Cursor、Codex、opencode、Hermes、Gemini、Antigravity、Kiro)启动 `springgraph serve --mcp` 时,三层机制会协同工作,保证索引始终跟得上代码变化,并避免在"刚编辑完成到下一次同步之间"的小窗口里给 agent 返回一个看起来没问题、实则过时的答案。

### 1. 文件监听 + 去抖自动同步(始终开启)

`serve --mcp` 会在项目根目录下启动一个原生文件监听器(macOS 上是 FSEvents,Linux 上是 inotify,Windows 上是 ReadDirectoryChangesW)。所有源文件的创建 / 修改 / 删除都会被捕获。去抖定时器会把突发性的多次编辑合并为一次同步。

```
agent writes src/Widget.ts
  → watcher fires (event delivery: typically <100ms)
  → 2000ms debounce
  → sync runs; Widget.ts's nodes + edges are in the index
  → next agent query sees it
```

**可调参数**:`SPRINGGRAPH_WATCH_DEBOUNCE_MS` 覆盖默认的 2000ms,允许范围 `[100ms, 60s]`。当构建步骤或格式化工具在短时间内写入大量文件时很有用 —— 把它调到 `5000` 或 `10000`,让监听器把这些写入合并为一次同步。

### 2. 单文件陈旧提示 —— 覆盖去抖窗口

监听器的去抖机制会带来一个短暂窗口(通常是 2 秒):文件已经写到了磁盘,但索引还没来得及更新。Springgraph 通过一个"按文件粒度"的陈旧提示来消除这个窗口:只要某个 MCP 工具的响应中会引用到一个"当前等待重新索引"的文件,响应开头就会插入一条 `⚠️` 提示,点名这个文件:

```
⚠️ Some files referenced below were edited since the last index sync —
their springgraph entries may be stale:
  - src/Widget.ts (edited 800ms ago, pending sync)
For accurate content of those specific files, Read them directly.
The rest of this response is fresh.

## Code Context
…
```

Agent 看到这条提示后会直接对被点名的文件发起 `Read`,在 Claude Code 上已经端到端验证过 —— agent 会明确说出 "Reading the file directly for the live content",然后再打开文件。因此即便处于 2 秒的去抖窗口里,agent 也绝不会拿到一个看似正常、实则错误的答案。

那些**没有**在响应中被引用、但仍在等待同步的文件,则会以一段简短的页脚呈现(`(Note: N file(s) elsewhere in this project are pending index sync but were not referenced above: …)`)。无论如何,信号始终是显式的。

### 3. 连接时的补齐 —— 覆盖 MCP 服务器未运行期间的空隙

当编辑器或 agent 重新连接到 MCP 服务器时,Springgraph 会在回答第一个查询之前,先基于文件系统做一次快速对账(先用 `(size, mtime)` 做 stat 预筛,再对剩下的文件做内容哈希)。这样,在 MCP 服务器没有运行期间发生的改动(在终端里 `git pull`、在另一个编辑器里编辑、上一个 agent 跑完退出了),都会在下一次会话的第一个工具调用时被自动补齐。

### 校验监听器看到的内容

`springgraph_status` 把"等待同步"的文件集合作为一等公民暴露出来 —— agent 只需一次调用就能问出"索引跟上了吗?":

```
springgraph_status →
  ## Springgraph Status
  …
  ### Pending sync:
  - src/Widget.ts (edited 1200ms ago)
```

如果响应里没有出现 `### Pending sync:`,说明没有任何待处理项。

### 什么时候手动 `springgraph sync` 才合理

几乎不需要。少数边界场景:

- **监听器被禁用了。** 例如沙箱阻止了本地文件系统监听,或者你通过 `SPRINGGRAPH_NO_DAEMON=1` 主动退出了共享守护进程。这种情况下,`springgraph sync` 是手动兜底手段。
- **CI 跑批前的预检。** 如果你在 agent 会话之外、基于索引跑脚本,那么在脚本开头加一次 `springgraph sync`,可以保证索引反映当前工作树。

其他场景:直接用监听器就行。"监听器 + 陈旧提示 + 连接时同步"已经端到端覆盖了 AI 辅助开发的工作流。如果你发现文件确实在去抖窗口过去之后仍然漏掉了同步,那就是 bug —— 欢迎带上复现步骤来提 issue。

> v0.9.5 发布说明里收录了 [staleness banner (#403)](https://github.com/jinglonglong/springgraph/releases/tag/v0.9.5) 与 connect-time catch-up (#414),这两项功能是一起发布的。

## 查看状态

```bash
springgraph status
```

输出节点 / 边 / 文件数量、当前激活的 SQLite 后端以及 journal mode。在 agent 会话里,基于 MCP 的 `springgraph_status` 还会额外输出上文提到的 `### Pending sync:` 区块。

## 哪些内容会被索引

凡是扩展名能够映射到某一种 [支持的语言](/springgraph/reference/languages/) 的文件都会被索引,减掉默认排除的依赖 / 构建目录(`node_modules`、`vendor`、`dist` 等)、`.gitignore` 中排除的文件,以及大于 1 MB 的文件。详见 [配置说明](/springgraph/getting-started/configuration/)。