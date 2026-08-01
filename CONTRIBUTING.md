# 贡献指南

感谢你对青梧UI（Qingwu UI）的兴趣。以下是参与贡献的基本约定。

## 环境

- [Bun](https://bun.sh) ≥ 1.3、Node ≥ 20
- `bun install` 安装依赖
- `bun run ci` 一键跑 lint + build + typecheck + test + size（提交前请保证全绿）

## 提 Issue

- 先搜索是否已有相同 issue；
- Bug 请附：复现步骤、期望行为、实际行为、浏览器/Node 版本；
- 历法数据（节假日 / 调休 / 节气）勘误请注明官方公告来源。

## 提 PR

1. 从 `main` 拉分支，命名建议 `fix/`、`feat/`、`docs/` 前缀；
2. 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)（`fix: ...` / `feat: ...`）；
3. 行为变更需附带 vitest 用例；无障碍（a11y）相关改动需说明键盘 / 读屏影响；
4. 涉及新增依赖时，请确认其许可证与本仓库（Apache-2.0）兼容，并在 PR 描述中注明；
5. 涉及第三方素材（UI 组件 / 图片 / 字体 / 文案）时，必须保留原始署名与许可证声明，并在 PR 描述中给出来源链接；
6. 合入由维护者 review 后完成；changesets 变更集可在 PR 中附带，也可由维护者补充。

## 社区行为

参与本项目即视为同意遵守 [CODE_OF_CONDUCT](./CODE_OF_CONDUCT.md)。
