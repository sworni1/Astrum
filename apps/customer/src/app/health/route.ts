import os from "node:os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  // HOSTNAME is pinned to 0.0.0.0 for the standalone server, so the kernel
  // hostname (the container id) is the instance identity here.
  return NextResponse.json({ status: "ok", instance: os.hostname() });
}
