import { NextResponse } from "next/server";
import { resetAll } from "@/lib/store";

// Demo helper: erase local jobs and photos. PayPal Sandbox is not touched.
export async function POST() {
  resetAll();
  return NextResponse.json({ ok: true });
}
