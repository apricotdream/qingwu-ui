/** 青梧UI 扇形动作菜单类型定义（框架无关类型契约） */

/** 单个扇形菜单项 */
export interface ActionMenuItem {
  /** 唯一 id（扇区 key 与 aria 引用） */
  id: string;
  /** 图标 HTML/SVG 字符串，渲染在扇区圆内 */
  icon: string;
  /** 菜单文字，hover 扇区时沿切向展开 */
  label: string;
  /** 点击触发的动作（onAction 回调之后调用） */
  onClick?: () => void;
  /** 禁用：置灰、不可触发、键盘导航跳过 */
  disabled?: boolean;
}

/** 内置 FAB 的悬浮位置（与 fixed 定位一致，省略的一侧由布局决定） */
export interface ActionMenuPosition {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** 扇形动作菜单构造配置 */
export interface ActionMenuOptions {
  /** 菜单项 */
  items?: ActionMenuItem[];
  /** 展开方向：left | right，默认 'right' */
  direction?: "left" | "right";
  /** 扇形张角（度），默认 180 */
  spread?: number;
  /** 图标弧半径 px（扇区圆心到触发器的距离），默认 56 */
  radius?: number;
  /** 内置 FAB 悬浮位置（仅 trigger 缺省时生效），默认右下角 */
  position?: ActionMenuPosition;
  /** 内置 FAB 图标，默认加号 */
  fabIcon?: string;
  /** 外部触发器元素：传入后菜单锚定其中心展开 */
  trigger?: HTMLElement | null;
  /** 附加到根容器的自定义类名 */
  className?: string;
  /** 无障碍标签（trigger aria-label） */
  ariaLabel?: string;
  /** 悬浮保持半径 px：指针离开该区域即收起，默认 radius + 130（覆盖展开后的 label） */
  closeRadius?: number;
  /** 展开/收起动画时长 ms，默认 220 */
  duration?: number;
  /** 是否启用动画，默认 true（自动尊重 prefers-reduced-motion） */
  animate?: boolean;
  /** 展开状态变化回调 */
  onOpenChange?: (open: boolean) => void;
  /** 任意菜单项触发时的回调（在 item.onClick 之前调用） */
  onAction?: (item: ActionMenuItem, index: number) => void;
}
