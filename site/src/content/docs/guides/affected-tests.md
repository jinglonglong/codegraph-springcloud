---
title: CI 中受影响的测试
description: 只运行本次改动真正影响到的测试。
---

`springgraph affected` 会沿着导入依赖关系进行传递追踪,找出受一组已变更源文件影响的测试文件,从而让 CI 只跑相关的测试。

```bash
springgraph affected src/utils.ts src/api.ts          # 直接传入文件
git diff --name-only | springgraph affected --stdin    # 从 git diff 管道输入
springgraph affected src/auth.ts --filter "e2e/*"      # 自定义测试文件匹配规则
```

## 选项

| 选项 | 说明 | 默认值 |
|---|---|---|
| `--stdin` | 从标准输入读取文件列表 | `false` |
| `-d, --depth <n>` | 依赖遍历的最大深度 | `5` |
| `-f, --filter <glob>` | 自定义用于识别测试文件的 glob 规则 | 自动识别 |
| `-j, --json` | 以 JSON 格式输出 | `false` |
| `-q, --quiet` | 仅输出文件路径 | `false` |

## CI / 钩子示例

```bash
#!/usr/bin/env bash
AFFECTED=$(git diff --name-only HEAD | springgraph affected --stdin --quiet)
if [ -n "$AFFECTED" ]; then
  npx vitest run $AFFECTED
fi
```