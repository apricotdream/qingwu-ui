import { type FC } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Note {
  version: string;
  date: string;
  items: string[];
}

const NOTES: Note[] = [
  {
    version: "0.9.0-beta.25",
    date: "2026-10-07",
    items: [
      "安装更省心：Tiptap 全套与文件预览全套改由编辑器自动管理，无需再手动逐个安装，版本也不会装错",
      "附件预览资源一条命令备好：npx @qingwu-ui/ai-editor copy-assets，自动拷贝 PDF / Word / Excel / PPT / 压缩包所需 worker",
    ],
  },
  {
    version: "0.9.0-beta.24",
    date: "2026-10-07",
    items: ["演示页新增本「更新日志」入口，可随时查看近期版本修复记录；README 文档同步补全"],
  },
  {
    version: "0.9.0-beta.23",
    date: "2026-10-07",
    items: ["修复手写反引号在行尾（如 `代码` 后直接回车）不能生成行内代码，现在行末也能识别"],
  },
  {
    version: "0.9.0-beta.22",
    date: "2026-10-07",
    items: ["图片、附件与正文之间的纵向间隔再收窄一半，从约 13px 减到约 7px"],
  },
  {
    version: "0.9.0-beta.21",
    date: "2026-10-07",
    items: [
      "图片、附件与文字间隔过大问题修复，统一间距并收窄约三分之一",
      "修复气泡菜单「高亮 / 链接」二级面板被编辑器下边缘遮挡：面板移到页面最外层，下方放不下时自动翻转到上方，滚动时自动收起",
    ],
  },
  {
    version: "0.9.0-beta.20",
    date: "2026-10-07",
    items: ["修复目录面板在编辑器快速卸载 / 重挂载时偶发报错，四处 DOM 读取改为安全跳过"],
  },
  {
    version: "0.9.0-beta.19",
    date: "2026-10-07",
    items: ["桌面目录移到页面最外层，修复宿主入场动画期间目录定位先闪现再跳位的问题"],
  },
];

export const ReleaseNotesDialog: FC<Props> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-default-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-default-200 bg-background px-5 py-4">
          <div>
            <div className="text-base font-semibold">更新日志</div>
            <div className="text-xs text-default-400">青梧 AI 编辑器版本记录</div>
          </div>
          <button
            type="button"
            className="text-default-400 hover:text-default-600 text-xl leading-none"
            onClick={onClose}
            title="关闭"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">
          {NOTES.map((n) => (
            <div key={n.version} className="mb-5 last:mb-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-qingwu-600">{n.version}</span>
                <span className="text-xs text-default-400">{n.date}</span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {n.items.map((it, i) => (
                  <li key={i} className="text-sm text-default-600 flex gap-2">
                    <span className="text-default-300 shrink-0">·</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
