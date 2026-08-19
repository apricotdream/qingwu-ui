/** IndexedDB 存储层 - 历史记录+设置；建索引支持全文搜索（替代 localStorage 容量/查询限制） */

import type { ClipperSettings, ClipRecord } from "../types";

const DB_NAME = "qingwu-clipper";
const DB_VERSION = 1;
const STORE_RECORDS = "records";
const STORE_KV = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const store = db.createObjectStore(STORE_RECORDS, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("notePath", "notePath");
        store.createIndex("favorite", "favorite");
        store.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const r = fn(s);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export const db = {
  async saveRecord(record: ClipRecord): Promise<void> {
    await tx(STORE_RECORDS, "readwrite", (s) => s.put(record));
  },

  async getRecord(id: string): Promise<ClipRecord | undefined> {
    return tx(STORE_RECORDS, "readonly", (s) => s.get(id));
  },

  async listRecords(
    opts: {
      query?: string;
      tag?: string;
      favoriteOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ items: ClipRecord[]; total: number }> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE_RECORDS, "readonly");
      const store = t.objectStore(STORE_RECORDS);
      const idx = store.index("createdAt");
      const results: ClipRecord[] = [];
      const q = (opts.query ?? "").trim().toLowerCase();
      const tag = opts.tag?.toLowerCase();

      const cursorReq = idx.openCursor(null, "prev");
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          const sliced = results.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50));
          resolve({ items: sliced, total: results.length });
          return;
        }
        const rec = cursor.value as ClipRecord;
        if (opts.favoriteOnly && !rec.favorite) {
          cursor.continue();
          return;
        }
        if (tag && !rec.tags.map((t) => t.toLowerCase()).includes(tag)) {
          cursor.continue();
          return;
        }
        if (q) {
          const hay =
            `${rec.noteTitle} ${rec.content.title} ${rec.content.excerpt} ${rec.tags.join(" ")}`.toLowerCase();
          if (!hay.includes(q)) {
            cursor.continue();
            return;
          }
        }
        results.push(rec);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  },

  async deleteRecord(id: string): Promise<void> {
    await tx(STORE_RECORDS, "readwrite", (s) => s.delete(id));
  },

  async allTags(): Promise<string[]> {
    const { items } = await this.listRecords({ limit: 500 });
    const set = new Set<string>();
    for (const r of items) for (const t of r.tags) set.add(t);
    return [...set].sort();
  },

  async recentPaths(limit = 20): Promise<string[]> {
    const { items } = await this.listRecords({ limit: 200 });
    const seen = new Map<string, number>();
    for (const r of items) {
      const ts = Number(new Date(r.createdAt));
      if (!seen.has(r.notePath) || seen.get(r.notePath)! < ts) {
        seen.set(r.notePath, ts);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map((x) => x[0]);
  },

  async getKV<T>(key: string): Promise<T | undefined> {
    return tx(STORE_KV, "readonly", (s) => s.get(key));
  },

  async setKV<T>(key: string, value: T): Promise<void> {
    await tx(STORE_KV, "readwrite", (s) => s.put(value, key));
  },
};

const SETTINGS_KEY = "settings";

export const settingsStore = {
  async get(): Promise<ClipperSettings | null> {
    const v = await db.getKV<ClipperSettings>(SETTINGS_KEY);
    return v ?? null;
  },
  async set(settings: ClipperSettings): Promise<void> {
    await db.setKV(SETTINGS_KEY, settings);
    // 同时镜像到 chrome.storage.local，方便 service worker 快速读取
    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    } catch {
      // 非 chrome 环境忽略
    }
  },
};

export async function loadSettings(): Promise<ClipperSettings> {
  const s = await settingsStore.get();
  return s ?? defaultSettings();
}

export function defaultSettings(): ClipperSettings {
  return {
    locale: "zh-CN",
    theme: "auto",
    accent: "qingwu",
    ai: null,
    templates: [defaultTemplate()],
    defaultTemplateId: "default",
    editorTarget: null,
    autoSummary: false,
    autoTags: false,
    recentPaths: ["Clippings/{{YYYY}}/{{MM}}"],
    recentTags: [],
    siteRules: [],
  };
}

export function defaultTemplate() {
  return {
    id: "default",
    name: "默认模板",
    isDefault: true,
    builtIn: true,
    body: [
      "---",
      "title: {{title}}",
      "url: {{url}}",
      "author: {{author}}",
      "published: {{published}}",
      "captured: {{captured}}",
      "tags: [{{tags}}]",
      "---",
      "",
      "# {{title}}",
      "",
      "> {{aiSummary}}",
      "",
      "{{content}}",
      "",
      "## 原文链接",
      "",
      "{{url}}",
    ].join("\n"),
  };
}
