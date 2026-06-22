---
title: API
description: 将 Springgraph 作为 TypeScript 库使用。
---

Springgraph 提供一套 TypeScript API。对外的公开接口是 `Springgraph` 类。

```typescript
import Springgraph from '@jinglonglong/springgraph';

const cg = await Springgraph.init('/path/to/project');
// 或者打开一个已有的索引:
// const cg = await Springgraph.open('/path/to/project');

await cg.indexAll({
  onProgress: (p) => console.log(`${p.phase}: ${p.current}/${p.total}`),
});

const results = cg.searchNodes('UserService');
const callers = cg.getCallers(results[0].node.id);
const context = await cg.buildContext('fix login bug', {
  maxNodes: 20,
  includeCode: true,
  format: 'markdown',
});
const impact = cg.getImpactRadius(results[0].node.id, 2);

cg.watch();   // 文件变更时自动同步
cg.unwatch(); // 停止监听
cg.close();
```

## 关键方法

| 方法 | 用途 |
|---|---|
| `Springgraph.init(path)` / `Springgraph.open(path)` | 创建或打开项目索引 |
| `indexAll(opts)` | 全量索引,带进度回调 |
| `sync()` | 增量更新 |
| `searchNodes(query)` | 符号的全文搜索 |
| `getCallers(id)` / `getCallees(id)` | 遍历调用图 |
| `getImpactRadius(id, depth)` | 变更的传递性影响范围 |
| `buildContext(task, opts)` | 为 AI 生成 Markdown / JSON 上下文 |
| `watch()` / `unwatch()` | 启动 / 停止文件监听 |
| `close()` | 关闭数据库连接 |
