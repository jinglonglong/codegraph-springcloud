---
title: 配置
description: Springgraph 零配置,没有配置文件。
---

没有配置。Springgraph 是**零配置**的,**没有配置文件**需要写或同步。语言支持按文件扩展名自动识别,无需为每个语言额外接线。

## 默认会跳过哪些内容

- **依赖、构建和缓存目录**:`node_modules`、`vendor`、`dist`、`build`、`target`、`.venv`、`Pods`、`.next` 等,覆盖每一个[支持的技术栈](/springgraph/reference/languages/),所以图谱里只装你的代码,不会有第三方噪音。即便没有 `.gitignore` 也照样生效。
- **`.gitignore` 里的任何内容**:在 git 仓库里走 git 的忽略逻辑;在非 git 项目中直接读取 `.gitignore`(根目录和嵌套的都算)。
- **大于 1 MB 的文件**:生成的 bundle、压缩过的 JS、第三方二进制文件。

## 排除或包含更多

要把别的目录也排除出去,把它加进 `.gitignore`。要把某个默认排除的目录**拉回来**(比如你确实想让 vendor 依赖也建索引),加一条反规则,例如 `!vendor/`。

默认规则是统一生效的,所以即便你把某个依赖或构建目录提交进了仓库,它也不会因此自动进入图谱。通过 `.gitignore` 加反规则才是明确的主动加入方式。

## 数据放在哪里

项目专属数据存放在项目根目录下的 `.springgraph/` 目录里,里面有 SQLite 数据库(`springgraph.db`)。所有数据都不会离开你的机器。
