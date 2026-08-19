/** 消息协议 - popup/sidepanel/content/background 通信；每条消息必有响应，错误带 code+message+retryable */

import type { AIRequest, AIResponse, ClipMode, ExtractedContent, Locale } from "./types";

export type MessageKind =
  | "ping"
  | "clip:extract"
  | "clip:save"
  | "clip:list"
  | "clip:get"
  | "clip:delete"
  | "clip:update"
  | "ai:run"
  | "ai:test"
  | "settings:get"
  | "settings:set"
  | "template:render"
  | "push:editor"
  | "download:md"
  | "ui:notify"
  | "tab:open-sidepanel";

export interface Message<T = unknown> {
  id: string;
  kind: MessageKind;
  payload: T;
}

export interface MessageResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    raw?: string;
    retryable?: boolean;
  };
}

export type ExtractPayload = { mode: ClipMode } | { mode: "selection"; selection: string };

export type SavePayload = {
  content: ExtractedContent;
  noteTitle: string;
  notePath: string;
  tags: string[];
  templateId: string;
  summary?: string;
  aiSummary?: string;
  aiTags?: string[];
  aiTranslation?: { lang: Locale; text: string } | null;
};

export type AIRunPayload = { request: AIRequest };

export type TemplateRenderPayload = {
  templateId: string;
  content: ExtractedContent;
  extra?: Record<string, string>;
};

export type PushEditorPayload = {
  recordId: string;
};

export type DownloadMdPayload = {
  recordId: string;
  filename?: string;
};

export type NotifyPayload = {
  level: "info" | "success" | "warning" | "error";
  message: string;
  detail?: string;
  duration?: number;
};

export type OpenSidePanelPayload = { tabId?: number };

export type ListPayload = {
  query?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  favoriteOnly?: boolean;
};

export type ListResult = {
  items: Array<{
    id: string;
    noteTitle: string;
    notePath: string;
    tags: string[];
    createdAt: string;
    favorite: boolean;
    status: string;
  }>;
  total: number;
};

export const MSG = {
  ping: (payload?: unknown): Message => ({
    id: crypto.randomUUID(),
    kind: "ping",
    payload: payload ?? null,
  }),
};

export function isMessage(v: unknown): v is Message {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Message).id === "string" &&
    typeof (v as Message).kind === "string"
  );
}

export function ok<T>(data: T): MessageResponse<T> {
  return { ok: true, data };
}

export function err(
  code: string,
  message: string,
  opts?: { raw?: string; retryable?: boolean },
): MessageResponse<never> {
  return {
    ok: false,
    error: { code, message, raw: opts?.raw, retryable: opts?.retryable },
  };
}

export type { AIRequest, AIResponse };
