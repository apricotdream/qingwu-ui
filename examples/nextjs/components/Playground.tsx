"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CodegenInput } from "@/lib/codegen";
import { genAll } from "@/lib/codegen";
import CodeTabs from "./CodeTabs";

/* ---- 描述符类型（每个组件的 playground.config 实现） ---- */

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "select" | "boolean" | "text" | "number";
  defaultValue: string;
  /** type=select 时的选项；boolean 默认渲染 开/关，也可自定义 */
  options?: FieldOption[];
  /** 实时生效：变化即调 handle.update，无需点应用 */
  live?: boolean;
}

export type LogFn = (msg: string) => void;

export interface PlaygroundHandle {
  destroy?: () => void;
  /** live 字段变化时调用；changedKey 为本次变化的字段 */
  update?: (values: Record<string, unknown>, changedKey: string, log: LogFn) => void;
}

export interface PlaygroundProps {
  title: string;
  desc: string;
  full?: boolean;
  fields: FieldDef[];
  /** 用「已应用」的面板值在 host 内创建组件，首屏与每次应用时调用 */
  create: (host: HTMLElement, values: Record<string, unknown>, log: LogFn) => PlaygroundHandle;
  /** 由面板值产出三框架代码输入 */
  toCode: (values: Record<string, unknown>) => Omit<CodegenInput, never>;
  /** 显示操作日志面板 */
  log?: boolean;
  /** 挂载点容器样式（宽度等） */
  hostStyle?: React.CSSProperties;
  minHeight?: number;
}

const BOOL_OPTIONS: FieldOption[] = [
  { label: "开启", value: "true" },
  { label: "关闭", value: "false" },
];

function parseValues(fields: FieldDef[], raw: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = raw[f.key] ?? f.defaultValue;
    if (f.type === "boolean") out[f.key] = v === "true";
    else if (f.type === "number") out[f.key] = Number(v);
    else out[f.key] = v;
  }
  return out;
}

const defaultsOf = (fields: FieldDef[]) =>
  Object.fromEntries(fields.map((f) => [f.key, f.defaultValue]));

/**
 * 统一组件实验台：属性控件 + 应用/重置 + 实时预览 + HTML/Vue/React 代码。
 * 页面范式：每个组件页页首恰好一个 Playground。
 */
export default function Playground({
  title,
  desc,
  full = true,
  fields,
  create,
  toCode,
  log: showLog = false,
  hostStyle,
  minHeight,
}: PlaygroundProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<PlaygroundHandle | null>(null);

  const [draft, setDraft] = useState<Record<string, string>>(() => defaultsOf(fields));
  const [applied, setApplied] = useState<Record<string, string>>(() => defaultsOf(fields));
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback<LogFn>((msg) => {
    setLogs((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const build = useCallback(
    (raw: Record<string, string>) => {
      const host = hostRef.current;
      if (!host) return;
      handleRef.current?.destroy?.();
      host.textContent = "";
      const values = parseValues(fields, raw);
      handleRef.current = create(host, values, addLog);
    },
    [fields, create, addLog],
  );

  /* 首屏挂载 + 卸载清理 */
  useEffect(() => {
    build(defaultsOf(fields));
    return () => handleRef.current?.destroy?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = () => {
    setLogs([]);
    build(draft);
    setApplied(draft);
  };

  const reset = () => {
    const d = defaultsOf(fields);
    setDraft(d);
    setLogs([]);
    build(d);
    setApplied(d);
  };

  const changeField = (field: FieldDef, value: string) => {
    setDraft((prev) => ({ ...prev, [field.key]: value }));
    if (field.live) {
      const next = { ...draft, [field.key]: value };
      setApplied(next);
      const values = parseValues(fields, next);
      handleRef.current?.update?.(values, field.key, addLog);
    }
  };

  const snippets = genAll(toCode(parseValues(fields, applied)));

  return (
    <article className={`demo-card${full ? " is-full" : ""}`}>
      <div className="demo-card-header">
        <h4>{title}</h4>
        <p>{desc}</p>
      </div>

      {/* 属性控件 */}
      <div className="cal-props-panel">
        <div className="cal-props-grid">
          {fields.map((field) => (
            <label key={field.key} className="cal-props-field">
              <span className="cal-props-label">
                {field.label}
                {field.live ? " · 实时" : ""}
              </span>
              {field.type === "select" || field.type === "boolean" ? (
                <select
                  className="cal-props-input"
                  value={draft[field.key]}
                  onChange={(e) => changeField(field, e.target.value)}
                >
                  {(field.type === "boolean" ? field.options ?? BOOL_OPTIONS : field.options)?.map(
                    (opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ),
                  )}
                </select>
              ) : (
                <input
                  className="cal-props-input"
                  type={field.type}
                  value={draft[field.key]}
                  onChange={(e) => changeField(field, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>
        <div className="cal-props-actions">
          <button className="qw-btn qw-btn-primary" type="button" onClick={apply}>
            应用
          </button>
          <button className="qw-btn" type="button" onClick={reset}>
            重置
          </button>
        </div>
      </div>

      {/* 预览区 */}
      <div className="demo-card-stage">
        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "flex-start",
            minHeight,
          }}
        >
          <div ref={hostRef} style={{ width: 320, maxWidth: "100%", ...hostStyle }} />
          {showLog && (
            <div className="cal-log-panel">
              <div className="cal-log-title">操作日志</div>
              <div className="cal-log-list">
                {logs.length === 0 ? (
                  <div className="cal-log-empty">暂无日志，操作组件后将在此显示</div>
                ) : (
                  logs.map((m, i) => (
                    <div key={i} className="cal-log-item">
                      {m}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <CodeTabs snippets={snippets} />
    </article>
  );
}

export type { CodegenInput };
