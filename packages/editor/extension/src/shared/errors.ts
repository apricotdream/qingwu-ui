/**
 * 错误处理 - 解决 Obsidian Web Clipper 静默失败的痛点
 *
 * 规则：
 * - 所有外部调用必须捕获并包装为 ClipperError
 * - AI 错误必须包含 code + 用户可读 message + retryable
 * - 错误默认冒泡到 UI，并附带可重试与降级方案
 */

import type { AIErrorCode } from "./types";

export class ClipperError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly raw?: unknown;
  readonly cause?: unknown;

  constructor(
    code: string,
    message: string,
    opts: { retryable?: boolean; raw?: unknown; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ClipperError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.raw = opts.raw;
    this.cause = opts.cause;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      raw: this.raw instanceof Error ? this.raw.message : String(this.raw ?? ""),
    };
  }
}

const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENETUNREACH",
  "ERR_NETWORK",
  "ERR_INTERNET_DISCONNECTED",
]);

const RATE_LIMIT_STATUS = 429;
const AUTH_STATUS = new Set([401, 403]);
const NOT_FOUND_STATUS = new Set([404, 405]);

export function toClipperError(e: unknown): ClipperError {
  if (e instanceof ClipperError) return e;

  if (e instanceof Error) {
    // fetch 网络错误
    if (e.name === "TypeError" && /fetch|network/i.test(e.message)) {
      return new ClipperError("network", "网络连接失败，请检查代理或网络", {
        retryable: true,
        raw: e.message,
        cause: e,
      });
    }
    if (e.name === "AbortError") {
      return new ClipperError("timeout", "请求超时（>30s）", {
        retryable: true,
        raw: e.message,
        cause: e,
      });
    }
    return new ClipperError("unknown", e.message, {
      retryable: false,
      raw: e.message,
      cause: e,
    });
  }

  return new ClipperError("unknown", String(e ?? "未知错误"), {
    raw: e,
  });
}

export function httpStatusToAIError(status: number, body?: string): ClipperError {
  if (status === RATE_LIMIT_STATUS) {
    return new ClipperError("rate-limit", "请求频率过高，请稍候重试", {
      retryable: true,
      raw: body,
    });
  }
  if (AUTH_STATUS.has(status)) {
    return new ClipperError(
      "auth-failed",
      "API Key 无效或权限不足，请在设置页检查",
      { retryable: false, raw: body },
    );
  }
  if (NOT_FOUND_STATUS.has(status)) {
    return new ClipperError(
      "model-not-found",
      "模型或接口路径不存在，请检查 baseURL 与 model",
      { retryable: false, raw: body },
    );
  }
  if (status >= 500) {
    return new ClipperError("provider-error", `服务方返回 ${status}，请稍候重试`, {
      retryable: true,
      raw: body,
    });
  }
  return new ClipperError("provider-error", `服务方返回 ${status}`, {
    retryable: false,
    raw: body,
  });
}

export function clipperErrorToAIError(
  e: ClipperError,
): { code: AIErrorCode; message: string; raw?: string; retryable: boolean } {
  return {
    code: e.code as AIErrorCode,
    message: e.message,
    raw: typeof e.raw === "string" ? e.raw : undefined,
    retryable: e.retryable,
  };
}

/** 把网络错误 code 也算作可重试 */
export function isRetryableCode(code: string): boolean {
  return (
    NETWORK_CODES.has(code) ||
    code === "network" ||
    code === "timeout" ||
    code === "rate-limit" ||
    code === "provider-error"
  );
}
