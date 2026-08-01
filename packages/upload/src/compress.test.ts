import { describe, expect, test } from "vitest";
import { compressImage } from "./compress";

function makeFile(type: string, name: string): File {
  return new File([new Uint8Array(64)], name, { type });
}

describe("compressImage 不支持压缩的类型", () => {
  test("GIF 动图返回空数组（由调用方按原图处理）", async () => {
    const out = await compressImage(
      makeFile("image/gif", "a.gif"),
      ["webp", "avif"],
      { quality: 0.8, maxWidth: 2048, maxHeight: 2048 },
      new Set(["image/webp"]),
    );
    expect(out).toHaveLength(0);
  });

  test("SVG 矢量图返回空数组", async () => {
    const out = await compressImage(
      makeFile("image/svg+xml", "a.svg"),
      ["webp"],
      { quality: 0.8, maxWidth: 2048, maxHeight: 2048 },
      new Set(["image/webp"]),
    );
    expect(out).toHaveLength(0);
  });
});
