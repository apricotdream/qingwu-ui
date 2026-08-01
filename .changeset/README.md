# Changesets

本目录由 [changesets](https://github.com/changesets/changesets) 管理，用于版本与发布编排。

新增变更时执行：

```bash
bun run changeset        # 描述本次变更，生成 .changeset/*.md
git add . && git commit
```

发布由 GitHub Actions（`.github/workflows/release.yml`）自动完成：
合入 `main` 后生成 Release PR，合并后以 `npm publish --provenance` 发布（供应链可验证）。
