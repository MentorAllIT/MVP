// app/api/mentee/refresh-match/route.ts
import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MENTEE_META_TABLE,
  AIRTABLE_MENTOR_META_TABLE,
  AIRTABLE_MATCH_RANKING_TABLE,
  JWT_SECRET,
} = process.env;

const ready =
  AIRTABLE_API_KEY &&
  AIRTABLE_BASE_ID &&
  AIRTABLE_MENTEE_META_TABLE &&
  AIRTABLE_MENTOR_META_TABLE &&
  AIRTABLE_MATCH_RANKING_TABLE &&
  JWT_SECRET;

let base: any = null;
if (ready) base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);

const esc = (s: string) => String(s).replace(/'/g, "\\'");
const nowISO = () => new Date().toISOString();

// Utilities
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e: any) {
      last = e;
      const transient = e?.code === "ETIMEDOUT" || e?.status === 429 || e?.statusCode === 429;
      if (transient && i < tries - 1) { await sleep(300 * (i + 1)); continue; }
      console.error(`${label} failed:`, e?.message || e);
      throw e;
    }
  }
  throw last;
}
async function firstPage(table: string, opts: any): Promise<any[]> {
  return withRetry<any[]>(`Select ${table}`, () => base(table).select(opts).firstPage());
}
async function batchCreate(table: string, records: any[]) {
  const CHUNK = 10;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    // @ts-ignore
    await withRetry(`Create ${table}`, () => base(table).create(slice));
  }
}
async function batchUpdate(table: string, records: any[]) {
  const CHUNK = 10;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    // @ts-ignore
    await withRetry(`Update ${table}`, () => base(table).update(slice));
  }
}

// Normalize Airtable Tags field to strings
function normalizeTags(raw: any): string[] {
  if (!raw) return [];
  const arr = (Array.isArray(raw) ? raw : [raw]).flat(5);
  const labels = arr.flatMap((t: any) => {
    const val =
      typeof t === "string"
        ? t
        : t?.name ?? t?.label ?? t?.value ?? t?.title ?? t?.text ??
          t?.fields?.name ?? t?.fields?.Name ?? t?.fields?.Title ?? "";
    if (!val) return [];
    return String(val)
      .split(/[,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  });
  // Dedupe
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of labels) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(tag); }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    if (!ready) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

    // Auth
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let uid = "", role = "";
    try {
      const payload = jwt.verify(token, JWT_SECRET!) as any;
      uid = payload.uid;
      role = payload.role;
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    if (role && role !== "mentee") {
      return NextResponse.json({ message: "Only mentees refresh matches" }, { status: 200 });
    }

    // Load mentee tags and last paired
    const [menteeRec] = await firstPage(AIRTABLE_MENTEE_META_TABLE!, {
      filterByFormula: `{UserID}='${esc(uid)}'`,
      maxRecords: 1,
      fields: ["UserID", "Tags", "LastPaired"],
    });
    if (!menteeRec) return NextResponse.json({ error: "MenteeMeta not found" }, { status: 404 });

    const menteeTags = normalizeTags(menteeRec.fields?.Tags);
    if (menteeTags.length === 0) {
      return NextResponse.json({ updated: 0, created: 0, total: 0, info: "No mentee tags" });
    }
    const menteeSet = new Set(menteeTags.map((t) => t.toLowerCase()));
    const menteeSize = menteeSet.size;
    const lastPairedISO: string | null = menteeRec.fields?.LastPaired || null;

    // Load mentors (only those updated after mentee last paired)
    let mentorFilter = "";
    if (lastPairedISO) {
      mentorFilter = `IS_AFTER({UpdatedAt}, DATETIME_PARSE('${esc(lastPairedISO)}'))`;
    }
    let mentorRows = await firstPage(AIRTABLE_MENTOR_META_TABLE!, {
      ...(mentorFilter ? { filterByFormula: mentorFilter } : {}),
      fields: ["UserID", "Tags", "UpdatedAt"],
    });
    // Fallback if no mentee last paired
    if (!lastPairedISO && mentorRows.length === 0) {
      mentorRows = await firstPage(AIRTABLE_MENTOR_META_TABLE!, {
        fields: ["UserID", "Tags", "UpdatedAt"],
      });
    }

    // Compute normalized scores
    type ScoreRow = { mentorId: string; score: number; overlap: number };
    const scores: ScoreRow[] = [];

    for (const r of mentorRows) {
      const mentorId = r.fields?.UserID as string | undefined;
      if (!mentorId || !menteeSize) continue;

      const mentorTags = new Set(
        normalizeTags(r.fields?.Tags).map((t) => t.toLowerCase())
      );
      if (mentorTags.size === 0) continue;

      let overlap = 0;
      for (const t of mentorTags) if (menteeSet.has(t)) overlap++;

      if (overlap === 0) continue;

      const union = menteeSize + mentorTags.size - overlap;
      const coverage = overlap / menteeSize;              // how much of mentee needs are covered
      const jaccard  = union > 0 ? overlap / union : 0;   // size-normalized similarity

      const score01 = 0.7 * coverage + 0.3 * jaccard;     // blend (tweakable)
      const score   = Math.round(100 * score01);          // 0..100 integer

      scores.push({ mentorId, score, overlap });
    }

    // If nobody overlaps, still bump mentee last paired so next run can be incremental
    if (!scores.length) {
      await withRetry("Update LastPaired", () =>
        base(AIRTABLE_MENTEE_META_TABLE!).update(menteeRec.id, { LastPaired: nowISO() })
      );
      return NextResponse.json({ updated: 0, created: 0, total: 0, info: "No overlapping tags" });
    }

    // Update MatchRanking for this mentee
    const existing = await firstPage(AIRTABLE_MATCH_RANKING_TABLE!, {
      filterByFormula: `{MenteeID}='${esc(uid)}'`,
      fields: ["MentorID"],
    });
    const existingMap = new Map<string, string>();
    for (const r of existing) {
      const mid = r.fields?.MentorID;
      if (mid) existingMap.set(String(mid), r.id);
    }

    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const ts = nowISO();

    for (const { mentorId, score } of scores) {
      const recId = existingMap.get(mentorId);
      if (recId) {
        toUpdate.push({ id: recId, fields: { Score: score} });
      } else {
        toCreate.push({ fields: { MenteeID: uid, MentorID: mentorId, Score: score} });
      }
    }

    try {
      if (toCreate.length) await batchCreate(AIRTABLE_MATCH_RANKING_TABLE!, toCreate);
      if (toUpdate.length) await batchUpdate(AIRTABLE_MATCH_RANKING_TABLE!, toUpdate);
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      if (msg.includes('Unknown field name: "Score"')) {
        return NextResponse.json(
          { error: `Operation failed: ${msg}` },
          { status: 422 }
        );
      }
      throw err;
    }

    // Update LastPaired so next run only checks recent mentors
    await withRetry("Update LastPaired", () =>
      base(AIRTABLE_MENTEE_META_TABLE!).update(menteeRec.id, { LastPaired: ts })
    );

    scores.sort((a, b) => b.score - a.score);
    console.log(scores)
    return NextResponse.json({
      total: scores.length,
      created: toCreate.length,
      updated: toUpdate.length,
      top: scores.slice(0, 10), // preview
    });
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 500;
    return NextResponse.json({ error: e?.message || "Server error" }, { status });
  }
}
