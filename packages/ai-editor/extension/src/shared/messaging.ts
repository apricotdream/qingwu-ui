/** 消息客户端 - popup/sidepanel/options 调 background 的统一封装；超时必有失败响应 */

import { ClipperError, toClipperError } from "./errors";
import type { Message, MessageKind, MessageResponse } from "./messages";
import { isMessage } from "./messages";

const DEFAULT_TIMEOUT = 60_000;

function getRuntime(): typeof chrome.runtime {
  // 同时兼容 chromium 与 firefox
  // @ts-expect-error - firefox 全局 browser
  return (typeof browser !== "undefined" ? browser : chrome).runtime;
}

export async function send<T = unknown>(
  kind: MessageKind,
  payload: unknown = null,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<T> {
  const msg: Message = {
    id: crypto.randomUUID(),
    kind,
    payload,
  };

  const runtime = getRuntime();
  const p = new Promise<MessageResponse<T>>((resolve, reject) => {
    try {
      runtime.sendMessage(msg, (resp: MessageResponse<T>) => {
        const err = chrome.runtime.lastError;
        if (err)
          reject(new ClipperError("runtime", err.message ?? "runtime error", { retryable: false }));
        else if (resp === undefined || resp === null)
          // 无应答不是成功：SW 冷启动竞态时通道静默关闭，翻译成 ok(null) 会让调用方崩溃
          reject(
            new ClipperError("runtime", "扩展后台未应答（可能在启动中），请重试", {
              retryable: true,
            }),
          );
        else resolve(resp);
      });
    } catch (e) {
      reject(toClipperError(e));
    }
  });

  const timer = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new ClipperError("timeout", `消息超时：${kind}（${timeoutMs}ms）`, {
            retryable: true,
          }),
        ),
      timeoutMs,
    ),
  );

  const resp = await Promise.race([p, timer]);
  if (!resp.ok) {
    throw new ClipperError(resp.error?.code ?? "unknown", resp.error?.message ?? "未知错误", {
      retryable: resp.error?.retryable,
      raw: resp.error?.raw,
    });
  }
  return resp.data as T;
}

export function registerHandler(
  handlers: Partial<
    Record<
      MessageKind,
      (
        msg: Message,
        sender: chrome.runtime.MessageSender,
      ) => Promise<MessageResponse> | MessageResponse
    >
  >,
) {
  const runtime = getRuntime();
  const listener = (
    msg: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (resp: MessageResponse) => void,
  ) => {
    if (!isMessage(msg)) return false;
    const handler = handlers[msg.kind];
    if (!handler) {
      sendResponse({
        ok: false,
        error: {
          code: "no-handler",
          message: `未注册的消息类型：${msg.kind}`,
          retryable: false,
        },
      });
      return false;
    }
    Promise.resolve(handler(msg, sender))
      .then(sendResponse)
      .catch((e) => {
        const err = toClipperError(e);
        sendResponse({
          ok: false,
          error: {
            code: err.code,
            message: err.message,
            raw: typeof err.raw === "string" ? err.raw : undefined,
            retryable: err.retryable,
          },
        });
      });
    return true; // 异步响应
  };
  runtime.onMessage.addListener(listener);
  return () => runtime.onMessage.removeListener(listener);
}

export function notifyBackground(
  level: "info" | "success" | "warning" | "error",
  message: string,
  detail?: string,
) {
  getRuntime()
    .sendMessage({
      id: crypto.randomUUID(),
      kind: "ui:notify",
      payload: { level, message, detail },
    })
    .catch(() => {
      /* 通知失败不影响主流程 */
    });
}
