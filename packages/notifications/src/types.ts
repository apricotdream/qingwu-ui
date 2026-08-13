/* ============================================================
   青梧UI · 通知铃铛类型定义
   Qingwu Notifications — framework-agnostic type contracts
   ============================================================ */

/** 单个通知条目（默认渲染 title + sub + glyph + 未读圆点） */
export interface NotificationItem {
  /** 唯一标识（onItemClick 原样返回） */
  id: string | number;
  /** 标题（必填） */
  title: string;
  /** 摘要/描述（可选，渲染在标题下方小字） */
  sub?: string;
  /** 左侧图标字符，默认取 title 首字 */
  glyph?: string;
  /** 是否未读（行尾显示未读圆点标识） */
  unread?: boolean;
  /** 自定义数据透传 */
  [key: string]: unknown;
}

/** 通知铃铛构造配置 */
export interface NotificationsOptions {
  /** 未读数：> 0 时触发器右上角显示红点徽标 */
  unreadCount?: number;
  /** 下拉面板条目列表 */
  items?: NotificationItem[];
  /** 空列表文案，默认「暂无消息」 */
  emptyText?: string;
  /** 触发器内容：默认内置铃铛图标；传 HTML 字符串或节点可完全自定义 */
  triggerContent?: string | HTMLElement;
  /** 触发器无障碍标签，默认「消息」 */
  ariaLabel?: string;
  /** 附加到根容器的自定义类名 */
  className?: string;
  /** 面板宽度：trigger 跟随触发器宽度 / auto 内容自适应（min-width 至少等于触发器），默认 auto */
  width?: "trigger" | "auto";
  /** 单个条目错峰动画时长 ms，默认 380 */
  duration?: number;
  /** 条目错峰间隔 ms，默认 28 */
  stagger?: number;
  /** 是否启用手风琴错峰动画，默认 true（自动尊重 prefers-reduced-motion） */
  animate?: boolean;
  /** 错峰动画最大条目数：超过即降级为面板整体淡入，0 表示不降级，默认 12 */
  maxStagger?: number;
  /** 受控展开 */
  open?: boolean;
  /** 非受控初始展开 */
  defaultOpen?: boolean;
  /** 自定义条目渲染（返回节点；缺省渲染 title/sub/glyph/unread） */
  renderItem?: (item: NotificationItem) => HTMLElement;
  /** 点击条目回调（组件自动收起面板） */
  onItemClick?: (item: NotificationItem) => void;
  /** 展开状态变化回调（宿主可在打开时标记全部已读） */
  onOpenChange?: (open: boolean) => void;
}
