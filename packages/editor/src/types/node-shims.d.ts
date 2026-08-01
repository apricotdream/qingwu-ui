/**
 * Node 运行时类型最小声明（仅覆盖 src/editor/clipper/receiver.ts 用到的部分）。
 * 完整类型请安装 `@types/node`；此处仅用于纯类型检查，不引入运行时依赖。
 */

declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    [Symbol.asyncIterator](): AsyncIterableIterator<Buffer | Uint8Array | string>;
  }
  export interface ServerResponse {
    writeHead(status: number, headers?: Record<string, string>): void;
    setHeader(name: string, value: string | string[]): void;
    end(data?: string | Buffer): void;
  }
  export interface Server {
    listen(port: number, host: string, cb?: () => void): Server;
    close(cb?: (err?: Error) => void): Server;
  }
  export function createServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Server;
}

interface Buffer extends Uint8Array {
  toString(encoding?: string): string;
}

declare const Buffer: {
  prototype: Buffer;
  isBuffer(obj: unknown): obj is Buffer;
  from(data: ArrayLike<number> | string, encoding?: string): Buffer;
  concat(list: ReadonlyArray<Buffer | Uint8Array>): Buffer;
};
