/* ============================================================
   指南 · 封面图接入范式
   单值字段（coverUrl: string）接入 Upload 的完整方案
   ============================================================ */

const SNIPPET_CONFIG = `import { ImageUpload } from "@apricotdream/upload";
import "@apricotdream/upload/style.css";

// 单值字段：一张封面只留一个 URL，默认值三连覆盖
const uploader = new ImageUpload(el, {
  trigger: "button",        // 小按钮形态，不与页面其他拖拽区抢事件
  formats: ["webp"],        // 只产一份 → 一个上传项 → 一个 URL
  maxCount: 1,              // 最多一张（注意：满额后再选会被拒绝，不是替换）
  multiple: false,
  urlImport: false,         // 关闭 URL 面板：外链语义由你自己的 URL 输入框承担
  uploadFn: uploadCover,    // 宿主 XHR：拿真进度 + 拿存储 URL
});`;

const SNIPPET_UPLOAD_FN = `// uploadFn 签名：Promise<void>，存储 URL 用 File 引用做 key 交给 onSuccess
const urlByFile = new Map<File, string>();

const uploadCover: UploadFn = (file, onProgress) =>
  new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/editor-assets");
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText);
          const url = body?.data?.url ?? body?.url;
          if (url) { urlByFile.set(file, url); resolve(); }
          else reject(new Error("资源服务未返回访问地址"));
        } catch {
          reject(new Error("资源服务响应解析失败"));
        }
      } else reject(new Error(\`上传失败：HTTP \${xhr.status}\`));
    };
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.send(form);
  });`;

const SNIPPET_LIFECYCLE = `const urlById = new Map<string, string>(); // item.id -> 本站路径（待删除资产）

uploader.onChange = (items) => {
  // 组件 remove(id) 只删列表项，存储删除是宿主的职责：
  // onChange 是全量列表，与 urlById 做差集即可。
  // 注意：单文件容器 ✕ 是 clear() 一键全清——onChange 一次收到空数组，差集自然全删
  const ids = new Set(items.map((i) => i.id));
  for (const [id, url] of urlById) {
    if (ids.has(id)) continue;
    urlById.delete(id);
    if (url.startsWith("/")) void removeAsset(url); // 只删本站资产，外链不碰
    if (currentFieldValue === url) onChangeField(""); // 被删的正是当前封面
  }
};

uploader.onSuccess = (item) => {
  const fullUrl = urlByFile.get(item.file);
  if (!fullUrl) return;
  const pathname = new URL(fullUrl).pathname; // 转相对路径存字段（规避 next/image remotePatterns）
  const prev = priorCoverRef.current;         // onStart 时记录的上一次字段值
  urlById.set(item.id, pathname);
  if (prev && prev !== pathname && prev.startsWith("/")) {
    void removeAsset(prev);                   // 换图：新图成功后再删旧图，失败则不删
  }
  onChangeField(pathname);
};`;

const SNIPPET_SUBMIT = `// 上传中 coverUrl 仍为空，提交按钮必须联动上传状态
<button disabled={isLast && (submitting || uploading)}>发布</button>
// 上传失败时 uploading=false、coverUrl 为空 → 校验器正常报「封面必填」+ 展示失败原因`;

const SNIPPET_EDIT = `// 编辑态：initialUrls 把已有 coverUrl 回显为成功项（缩略图 + 已上传 + 删除）
new ImageUpload(el, {
  initialUrls: existingCoverUrl ? [existingCoverUrl] : [], // 编辑态回显
  // 回显项渲染为成功态，不参与上传；删除走 remove → onChange 差集（宿主删存储 + 清字段）
});`;

export default function CoverUploadGuide() {
  return (
    <article className="docs-article">
      <h2 id="problem">问题：默认值是陷阱</h2>
      <p>
        <code>Upload</code> 的默认配置面向<b>多图相册</b>场景：一张图默认产出
        <code> original + webp + avif</code> 三份（<code>formats</code>）、允许多选 （
        <code>multiple: true</code>）、数量不限（<code>maxCount: 0</code>）。而封面是
        <b>单值字段</b>（如 <code>coverUrl: string</code>）——三个默认值一个都不满足，必须显式覆盖：
      </p>
      <table>
        <thead>
          <tr>
            <th>默认值</th>
            <th>后果</th>
            <th>封面场景覆盖</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>formats: ["original","webp","avif"]</code>
            </td>
            <td>一张封面 = 3 个上传项 = 3 次上传 = 3 份存储 = 3 个 URL</td>
            <td>
              <code>formats: ["webp"]</code> —— 只产一份
            </td>
          </tr>
          <tr>
            <td>
              <code>maxCount: 0</code>（不限）
            </td>
            <td>无上限，单值字段装不下多张</td>
            <td>
              <code>maxCount: 1</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>multiple: true</code>
            </td>
            <td>一次多选，列表撑爆</td>
            <td>
              <code>multiple: false</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        注意：<code>maxCount: 1</code> 满额后再选新图是<b>拒绝</b>，不是替换 （
        <code>validateFile</code> 直接返回 <code>"count"</code>）——换图由宿主完成（见下文）。
      </p>
      <p>
        <b>单文件模式的容器行为</b>：<code>maxCount: 1</code> 时拖拽容器本身承载大图预览——
        成功/上传中显示图片，悬停显示「点击移除」（右上角 ✕ 为<b>一键清空</b>：该图衍生的
        全部格式项、回显项与上传中的请求一并清除，即 <code>clear()</code> 语义），列表同步隐藏； URL
        导入入口位于图片框内底部（大图态隐藏，恢复默认后重现）；上传过程有 350ms
        视觉保底，快速上传不会一闪而过。
      </p>

      <h2 id="config">接入配置</h2>
      <p>
        用 <code>trigger: "button"</code> 形态：不占版面、不与页面其他拖拽区抢事件，同时关闭 URL
        面板 ——URL 的「外链原样入库」语义由你自己的 URL 输入框承担，<code>Upload</code> 的 URL
        导入是 「下载外链 → 压缩 → 重传到你的存储」的资源搬移语义，两者天差地别，别混。
      </p>
      <pre>
        <code>{SNIPPET_CONFIG}</code>
      </pre>

      <h2 id="url-lifecycle">URL 生命周期：宿主的 map</h2>
      <p>两个事实决定 URL 必须由宿主持有：</p>
      <ul>
        <li>
          <code>UploadItem</code> 没有「上传结果 URL」字段（<code>originalUrl</code> 是 URL
          导入的源地址，不是产物地址）
        </li>
        <li>
          内置 XHR 上传不解析响应体——<code>load</code> 只检查状态码，宿主拿不到存储 URL。
          所以封面场景必须用 <code>uploadFn</code>，宿主自己拿 URL
        </li>
      </ul>
      <p>
        <code>uploadFn</code> 签名是 <code>Promise&lt;void&gt;</code>，拿不到 item.id——用
        <b>File 引用</b>做 key 把 URL 交给 <code>onSuccess</code>（传给 uploadFn 的
        <code>item.file</code> 是同一引用）。
      </p>
      <pre>
        <code>{SNIPPET_UPLOAD_FN}</code>
      </pre>
      <p>
        删除链路：用户点删除 → 组件 <code>remove(id)</code> 同步触发 <code>onChange</code>
        （只删列表项，不碰存储）→ 宿主拿全量 items 与自己的 map 做差集 → 被移除的 id 对应 URL →
        调存储删除接口。存储删除是宿主的职责，组件不做。
      </p>
      <pre>
        <code>{SNIPPET_LIFECYCLE}</code>
      </pre>

      <h2 id="replace-edit">换图与编辑态</h2>
      <p>
        编辑已有封面时，用 <code>initialUrls</code> 把 <code>coverUrl</code> 回显为成功项 （缩略图 +
        已上传 + 删除按钮），无需组件外另挂预览。回显项计入数量上限——
        <code>maxCount: 1</code> 时换图需先删旧项（列表 ✕ → onChange 差集删存储 + 清字段）再选新图。
      </p>
      <pre>
        <code>{SNIPPET_EDIT}</code>
      </pre>
      <p>
        换图删除时机：<b>新图成功后再删旧图</b>。先删的代价不可逆——新图上传失败 → 旧图存储已删、
        字段还显示旧图 →
        发布即裂图。后删的唯一代价是孤儿图（上传成功但未发布就关页），那是存量问题。 且只删
        <b>本站资产</b>（相对路径 <code>/</code> 开头）——手动填的外链 URL 绝不碰。
      </p>

      <h2 id="validation">提交校验联动</h2>
      <p>
        上传是异步的：上传中 <code>coverUrl</code> 还是空，用户手快点提交 → 校验器报「封面必填」。
        不要在校验器里感知上传状态，直接<b>提交按钮联动上传状态</b>：
      </p>
      <pre>
        <code>{SNIPPET_SUBMIT}</code>
      </pre>
      <p>
        上传中用户仍可填写其他字段，只有提交被禁；上传失败 → 状态复位 → 校验器正常报错 +
        失败原因展示。
      </p>
    </article>
  );
}
