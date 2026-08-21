# @qingwu-ui/carousel

## 0.9.2-beta
### Minor Changes

- 横滑手势加「纵向分量拒绝」：斜滑（|dx| ≤ 1.2×|dy|）只让页面原生滚动、不再切卡，消除移动端「图也换、页也跳」的双重动作

## 0.9.1-beta
### Minor Changes

- 新增触屏横滑切换：图片区 pointer 手势（`touch-action: pan-y` 保留页面纵向滚动，位移 48px 阈值过滤点按），鼠标拖拽不启用
- 新增悬浮缩略图变体（opt-in）：根元素追加 `qcar--thumbs-float` 类后，≤560px 缩略图条与图片区同格重叠、毛玻璃胶囊悬浮于卡片底部，缩略图出流后卡片整体变矮
- 演示页 `/demo/carousel` 新增「悬浮缩略图」控制项，README 补充移动端章节
