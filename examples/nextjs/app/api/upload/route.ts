import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";

/**
 * 上传演示接口：接收 FormData 中的 file 字段，保存到系统临时目录。
 * 仅用于演示上传进度，正式场景请替换为对象存储/业务后端。
 */
export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
    }
    const path = join(tmpdir(), `qw-upload-${Date.now()}-${file.name}`);
    await writeFile(path, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, name: file.name, size: file.size });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "上传失败" },
      { status: 500 },
    );
  }
}
