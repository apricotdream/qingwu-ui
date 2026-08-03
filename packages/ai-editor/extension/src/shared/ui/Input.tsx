import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const BASE =
  "w-full rounded-lg bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none focus:border-qingwu-500 focus:ring-2 focus:ring-qingwu-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...rest }, ref) => (
    <input ref={ref} className={`${BASE} ${className}`} {...rest} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...rest }, ref) => (
  <textarea ref={ref} className={`${BASE} resize-y min-h-[80px] ${className}`} {...rest} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...rest }, ref) => (
    <select ref={ref} className={`${BASE} pr-8 ${className}`} {...rest}>
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-ink-700 dark:text-ink-300 mb-1.5">
      {children}
      {hint && <span className="text-ink-400 font-normal">· {hint}</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && <Label hint={hint}>{label}</Label>}
      {children}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-qingwu-600" : "bg-ink-300 dark:bg-ink-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "accent" | "outline" | "muted";
  className?: string;
}) {
  const cls =
    variant === "accent"
      ? "bg-qingwu-50 text-qingwu-700 dark:bg-qingwu-900/40 dark:text-qingwu-300"
      : variant === "outline"
        ? "border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300"
        : variant === "muted"
          ? "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400"
          : "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cls} ${className}`}
    >
      {children}
    </span>
  );
}
