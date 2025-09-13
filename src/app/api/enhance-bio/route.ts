import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const { GEMINI_API_KEY } = process.env;

const PRIMARY_MODEL  = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

function buildPrompt(role: "mentor" | "mentee", bio: string) {
  const roleHints =
    role === "mentor"
      ? "Focus on: title/company, years of experience, key stacks/domains, mentoring areas (interviews, system design), mentoring style (e.g. hands-on code reviews)."
      : "Focus on: degree/status & school/bootcamp, interests/domains, graduation year, notable projects/internships, immediate goals.";

  return `Rewrite the following into a concise, first-person professional bio for a ${role} profile. Improve clarity and grammar, keep all facts from the original, and do NOT invent details.
Guidelines:
- 2–4 sentences (about 60–120 words).
- Friendly, confident, LinkedIn-appropriate.
- Avoid emojis and buzzword stuffing.
- Keep it truthful; if info is missing, do not make it up.
${roleHints}

Original bio:
\"\"\"
${bio}
\"\"\" 

Return only the rewritten bio.`;
}

async function generateOnce(ai: GoogleGenAI, model: string, prompt: string) {
  const res = await ai.models.generateContent({
    model,
    contents: prompt
  });
  const text = (res?.text ?? "").toString().trim();
  if (!text) throw new Error("EMPTY_RESPONSE");
  return text.replace(/^\s*["']?|["']?\s*$/g, "").slice(0, 600);
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({} as any));
    const roleIn = (body?.role === "mentor" ? "mentor" : "mentee") as "mentor" | "mentee";
    const bio = typeof body?.bio === "string" ? body.bio : "";
    if (!bio || bio.trim().length < 10) {
      return NextResponse.json({ error: "Missing or too-short bio" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(roleIn, bio);

    try {
      const enhanced = await generateOnce(ai, PRIMARY_MODEL, prompt);
      return NextResponse.json({ enhanced });
    } catch (e: any) {
      const msg = String(e?.message || e);
      // Try a lighter model if the primary is unavailable
      if (/NOT_FOUND|INVALID_ARGUMENT|model not found|404/i.test(msg)) {
        const enhanced = await generateOnce(ai, FALLBACK_MODEL, prompt);
        return NextResponse.json({ enhanced });
      }
      if (msg === "EMPTY_RESPONSE") {
        return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
      }
      throw e;
    }
  } catch (err) {
    console.error("enhance-bio POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
