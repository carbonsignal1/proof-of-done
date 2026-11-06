import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PayPalError } from "./paypal";
import { GeminiError } from "./gemini";
import { JobError } from "./jobs";
import { savePhoto } from "./store";

export function errorResponse(e: unknown) {
  if (e instanceof JobError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof PayPalError) {
    return NextResponse.json({ error: e.message, details: e.details, debugId: e.debugId }, { status: 502 });
  }
  if (e instanceof GeminiError) return NextResponse.json({ error: e.message }, { status: e.status === 429 ? 503 : 502 });
  if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "The Anthropic API key was rejected." }, { status: 502 });
  if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI is rate limited. Try again in a moment." }, { status: 503 });
  if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `AI error: ${e.message}` }, { status: 502 });
  console.error(e);
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Pull an image out of a multipart form and store it. */
export async function photoFromForm(form: FormData, field = "photo"): Promise<string> {
  const file = form.get(field);
  if (!(file instanceof File)) throw new JobError("A photo is required.");
  if (!TYPES.includes(file.type)) throw new JobError("Photos must be JPEG, PNG or WebP.");
  if (file.size > MAX_BYTES) throw new JobError("That photo is too large (max 8 MB).");
  return savePhoto(Buffer.from(await file.arrayBuffer()), file.type);
}
