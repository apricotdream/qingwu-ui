import type { NextRequest } from "next/server";
import { previewResource } from "../../../../../../packages/ai-editor/tooling/preview-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return previewResource(path.join("/"));
}
