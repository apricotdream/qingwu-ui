/* 骨架屏各演示卡使用的真实布局 HTML（骨架只写一次真实布局即可自动测量） */

/* ── 产品卡片 HTML 模板 ── */
export function buildProductCardHTML(): string {
  return `
    <div class="sk-card" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;max-width:360px;font-family:system-ui,-apple-system,sans-serif">
      <div class="sk-card-img" style="height:200px;background:linear-gradient(135deg,#d4e0f0,#e8d4f0);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:48px;color:#fff">图</div>
      <h3 style="margin:0;font-size:16px;font-weight:600;line-height:1.5;color:#1a1a1a">2025 春季新款女士连衣裙 优雅气质中长款法式收腰显瘦</h3>
      <div style="font-size:20px;font-weight:700;color:#e8453c">¥299.00</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="sk-tag" style="display:inline-block;padding:2px 8px;background:#fff0f0;color:#e8453c;border-radius:4px;font-size:12px">限时特惠</span>
        <span class="sk-tag" style="display:inline-block;padding:2px 8px;background:#f0f7ff;color:#3b82f6;border-radius:4px;font-size:12px">包邮</span>
        <span class="sk-tag" style="display:inline-block;padding:2px 8px;background:#f0fff4;color:#22c55e;border-radius:4px;font-size:12px">7天无理由</span>
      </div>
      <button class="sk-btn" style="width:100%;padding:10px 0;background:#1a1a1a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">加入购物车</button>
    </div>
  `;
}

/* ── 表单 HTML 模板 ── */
export function buildFormHTML(): string {
  const inputStyle =
    "width:100%;padding:8px 12px;border:1px solid #d4d4d4;border-radius:6px;font-size:14px;box-sizing:border-box";
  const labelStyle = "display:block;font-size:14px;font-weight:500;color:#333;margin-bottom:4px";
  return `
    <form class="sk-form" style="display:flex;flex-direction:column;gap:16px;padding:20px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;max-width:420px;font-family:system-ui,-apple-system,sans-serif">
      <div>
        <label style="${labelStyle}">姓名</label>
        <input style="${inputStyle}" placeholder="请输入姓名" />
      </div>
      <div>
        <label style="${labelStyle}">手机号</label>
        <input style="${inputStyle}" placeholder="请输入手机号" />
      </div>
      <div>
        <label style="${labelStyle}">邮箱</label>
        <input style="${inputStyle}" placeholder="请输入邮箱地址" />
      </div>
      <div>
        <label style="${labelStyle}">性别</label>
        <select style="${inputStyle}">
          <option>请选择</option>
          <option>男</option>
          <option>女</option>
        </select>
      </div>
      <div>
        <label style="${labelStyle}">个人简介</label>
        <textarea style="${inputStyle};min-height:80px;resize:vertical" placeholder="请介绍一下自己"></textarea>
      </div>
      <button type="button" style="width:100%;padding:10px 0;background:#1a1a1a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">提交</button>
    </form>
  `;
}

/* ── 迷你卡片 HTML 模板（多容器动画演示用） ── */
export function buildMiniCardHTML(tint: string): string {
  return `
    <div style="display:flex;flex-direction:column;gap:8px;padding:12px;background:${tint};border-radius:10px;font-family:system-ui">
      <div style="height:80px;background:rgba(255,255,255,0.75);border-radius:8px"></div>
      <div style="height:14px;background:rgba(255,255,255,0.75);border-radius:4px"></div>
      <div style="height:14px;width:70%;background:rgba(255,255,255,0.75);border-radius:4px"></div>
      <div style="height:28px;background:rgba(255,255,255,0.75);border-radius:6px"></div>
    </div>
  `;
}
