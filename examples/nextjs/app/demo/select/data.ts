import type { SelectOption } from "@qingwu-ui/select";

/* 演示数据：框架阵营 */
export const FRAMEWORKS: SelectOption[] = [
  { value: "react", label: "React", hint: "框架无关 · 原生 DOM 渲染", glyph: "R" },
  { value: "vue", label: "Vue", hint: "new Select(el, opts) 即用", glyph: "V" },
  { value: "svelte", label: "Svelte", hint: "同一份 JS 无需包装", glyph: "S" },
  { value: "solid", label: "Solid", hint: "零依赖 · 零样板", glyph: "S" },
  { value: "angular", label: "Angular", hint: "指令里挂载即可", glyph: "A" },
  { value: "vanilla", label: "原生 JS", hint: "npm 包直连", glyph: "JS" },
  { value: "qwik", label: "Qwik", hint: "按需实例化", glyph: "Q" },
  { value: "preact", label: "Preact", hint: "兼容 React 心智", glyph: "P" },
  { value: "lit", label: "Lit", hint: "即将支持", disabled: true, glyph: "L" },
  { value: "ember", label: "Ember", hint: "即将支持", disabled: true, glyph: "E" },
];

/* 受控演示数据：城市 */
export const CITIES: SelectOption[] = [
  { value: "beijing", label: "北京", hint: "华北 · 首都" },
  { value: "shanghai", label: "上海", hint: "华东 · 经济中心" },
  { value: "guangzhou", label: "广州", hint: "华南 · 千年商都" },
  { value: "chengdu", label: "成都", hint: "西南 · 天府之国" },
  { value: "hangzhou", label: "杭州", hint: "华东 · 数字之城" },
  { value: "shenzhen", label: "深圳", hint: "华南 · 科技之都" },
  { value: "nanjing", label: "南京", hint: "华东 · 六朝古都" },
  { value: "wuhan", label: "武汉", hint: "华中 · 九省通衢" },
];
