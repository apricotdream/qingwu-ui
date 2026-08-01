import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastLevel = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: string;
  level: ToastLevel;
  message: string;
  detail?: string;
  duration: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  push: (t: Omit<ToastItem, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastLevel, ReactNode> = {
  info: <span className="text-sky-500">ⓘ</span>,
  success: <span className="text-emerald-500">✓</span>,
  warning: <span className="text-amber-500">⚠</span>,
  error: <span className="text-rose-500">⨯</span>,
};

const BG: Record<ToastLevel, string> = {
  info: "bg-white/95 dark:bg-ink-900/95 border-ink-200 dark:border-ink-700",
  success: "bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800",
  warning: "bg-amber-50/95 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800",
  error: "bg-rose-50/95 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((s) => s.filter((i) => i.id !== id));
  }, []);

  const push = useCallback<ToastContextValue["push"]>(
    (t) => {
      const id = crypto.randomUUID();
      const item: ToastItem = { id, duration: 4000, ...t };
      setItems((s) => [...s, item]);
      if (item.duration > 0) {
        setTimeout(() => dismiss(id), item.duration);
      }
      return id;
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[360px]">
        <AnimatePresence>
          {items.map((it) => (
            <motion.div
              key={it.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto rounded-xl border shadow-pop backdrop-blur px-3.5 py-2.5 ${BG[it.level]}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 text-base leading-none">{ICONS[it.level]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100">
                    {it.message}
                  </div>
                  {it.detail && (
                    <div className="text-xs mt-0.5 text-ink-600 dark:text-ink-400 break-words">
                      {it.detail}
                    </div>
                  )}
                  {it.action && (
                    <button
                      onClick={() => {
                        it.action?.onClick();
                        dismiss(it.id);
                      }}
                      className="mt-1.5 text-xs font-medium text-qingwu-700 dark:text-qingwu-300 hover:underline"
                    >
                      {it.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismiss(it.id)}
                  className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 text-sm leading-none"
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const v = useContext(ToastContext);
  if (!v) throw new Error("useToast 必须在 ToastProvider 内使用");
  return v;
}
