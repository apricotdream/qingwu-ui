# Changesets

本目录由 [changesets](https://github.com/changesets/changesets) 管理，用于版本与发布编排。

新增变更时执行：

```bash
bun run changeset        # 描述本次变更，生成 .changeset/*.md
git add . && git commit
```

发布在本地执行：`bun run release`（build + publish-check）→ 显式 `--registry` 发布到私有 Nexus registry；发布后提交并推送远端仓库。
