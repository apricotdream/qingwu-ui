export interface AvatarEditorResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  /** 输出圆角半径，单位 px */
  radius: number;
}

export interface AvatarEditorOptions {
  /** 已有头像地址；跨域地址需允许 CORS，否则本地导出会被画布污染 */
  initialUrl?: string;
  /** 展示头像尺寸 px，默认 96 */
  size?: number;
  /** 导出图片尺寸（正方形边长），默认 256 */
  outputSize?: number;
  /** 圆角率 0-50（百分比），默认 50 */
  radius?: number;
  /** 最大缩放倍数（相对完整覆盖编辑区的最小缩放），默认 3 */
  maxZoom?: number;
  /** 接受的图片类型，默认 image/* */
  accept?: string;
  /** 附加类名 */
  className?: string;
  ariaLabel?: string;
  onConfirm?: (result: AvatarEditorResult) => void;
  onOpenChange?: (open: boolean) => void;
}
