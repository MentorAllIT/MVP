import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_USERS_TABLE,
  AIRTABLE_PROFILES_TABLE,
  AIRTABLE_MENTOR_META_TABLE,
  AIRTABLE_MATCH_RANKING_TABLE,
  JWT_SECRET,
} = process.env;

const ready =
  AIRTABLE_API_KEY &&
  AIRTABLE_BASE_ID &&
  AIRTABLE_USERS_TABLE &&
  AIRTABLE_PROFILES_TABLE &&
  AIRTABLE_MENTOR_META_TABLE &&
  AIRTABLE_MATCH_RANKING_TABLE &&
  JWT_SECRET;

let base: any = null;
if (ready) base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);

const esc = (s: string) => String(s).replace(/'/g, "\\'");
const clean = (v: any) =>
  typeof v === "string"
    ? v
        .replace(/\s+/g, " ")
        .replace(/(\s*,\s*)+,/g, ", ")
        .replace(/,\s*$/, "")
        .trim()
    : v;

// Retry helper
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      last = e;
      const transient = e?.code === "ETIMEDOUT" || e?.status === 429 || e?.statusCode === 429;
      if (transient && i < tries - 1) {
        await sleep(300 * (i + 1));
        continue;
      }
      console.error(`${label} failed:`, e?.message || e);
      throw e;
    }
  }
  throw last;
}

async function firstPage(table: string, options: any): Promise<any[]> {
  return withRetry<any[]>(`Select ${table}`, () => base(table).select(options).firstPage());
}

async function fetchByUserIds(table: string, ids: string[], fields?: string[]): Promise<any[]> {
  if (!ids.length) return [];
  const CHUNK = 10;
  const all: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const filter = `OR(${slice.map((id) => `{UserID}='${esc(id)}'`).join(",")})`;
    const rows: any[] = await firstPage(table, { filterByFormula: filter, fields });
    all.push(...rows);
  }
  return all;
}

// Convert tags to array of strings
function normalizeTags(raw: any): string[] {
  if (!raw) return [];
  const flat = (Array.isArray(raw) ? raw : [raw]).flat(5);
  const labels = flat.flatMap((t: any) => {
    let val = "";
    
    // Handle Airtable-generated tag objects
    if (typeof t === "object" && t !== null) {
      if (t.value) {
        val = t.value; // Extract the actual tag value
      } else if (t.name) {
        val = t.name;
      } else if (t.label) {
        val = t.label;
      } else if (t.title) {
        val = t.title;
      } else if (t.text) {
        val = t.text;
      }
    } else if (typeof t === "string") {
      val = t;
    }
    
    if (!val) return [];
    
    // Split comma/semicolon separated values and clean them
    return String(val)
      .split(/[,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  });
  
  // Dedupe and limit
  return Array.from(new Set(labels)).slice(0, 30);
}

export async function GET(req: NextRequest) {
  try {
    if (!ready) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

    // Auth
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    let uid = "";
    try {
      uid = (jwt.verify(token, JWT_SECRET!) as any).uid;
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Mentee matches with enhanced scoring - get only top 1 by score
    const matchRows: any[] = await firstPage(AIRTABLE_MATCH_RANKING_TABLE!, {
      filterByFormula: `{MenteeID}='${esc(uid)}'`,
      fields: ["MenteeID", "MentorID", "UpdatedAt", "Score", "PreferenceScore", "TagScore", "Breakdown"],
      sort: [{ field: "Score", direction: "desc" }],
      maxRecords: 1,
    });

    const mentorIds = Array.from(
      new Set(matchRows.map((r: any) => r.fields?.MentorID).filter(Boolean) as string[])
    );
    if (!mentorIds.length) return NextResponse.json({ mentors: [] });

    // Joins
    const [userRows, profileRows, metaRows] = await Promise.all([
      fetchByUserIds(AIRTABLE_USERS_TABLE!, mentorIds, ["UserID", "Name"]),
      fetchByUserIds(AIRTABLE_PROFILES_TABLE!, mentorIds, ["UserID", "Bio", "LinkedIn"]),
      fetchByUserIds(AIRTABLE_MENTOR_META_TABLE!, mentorIds, [
        "UserID",
        "Industry",
        "YearExp",
        "Skill",
        "Location",
        "Role",
        "Company",
        "SchoolName",
        "FieldOfStudy",
        "Tags",
        "UpdatedAt",
      ]),
    ]);

    const byId = (rows: any[], pick: (f: any) => any) =>
      Object.fromEntries(
        rows.map((r) => r.fields).filter((f) => f?.UserID).map((f) => [f.UserID, pick(f)])
      );

    const users = byId(userRows, (f) => ({ name: clean(f.Name) ?? null }));
    const profiles = byId(profileRows, (f) => ({
      bio: clean(f.Bio) ?? null,
      linkedIn: f.LinkedIn ?? null,
    }));
    const meta = byId(metaRows, (f) => ({
      industry: clean(f.Industry) ?? null,
      yearExp: typeof f.YearExp === "number" ? f.YearExp : null,
      skill: f.Skill ?? null, // UI splits it
      location: clean(f.Location) ?? null,
      role: clean(f.Role) ?? null,
      company: clean(f.Company) ?? null,
      schoolName: clean(f.SchoolName) ?? null,
      fieldOfStudy: clean(f.FieldOfStudy) ?? null,
      tags: normalizeTags(f.Tags),
      metaUpdatedAt: f.UpdatedAt ?? null,
    }));

    // Merge with enhanced scoring - already sorted by score from Airtable
    const mentors = matchRows
      .map((r: any) => {
        const id = r.fields?.MentorID as string;
        return {
          userId: id,
          rankedUpdatedAt: r.fields?.UpdatedAt ?? null,
          name: users[id]?.name ?? null,
          bio: profiles[id]?.bio ?? null,
          linkedIn: profiles[id]?.linkedIn ?? null,
          // Enhanced scoring data
          score: r.fields?.Score ?? null,
          preferenceScore: r.fields?.PreferenceScore ?? null,
          tagScore: r.fields?.TagScore ?? null,
          breakdown: r.fields?.Breakdown ?? null,
          ...(meta[id] ?? {}),
        };
      });
    
    console.log("Enhanced mentor matches:", mentors);
    // Safety check: ensure only 1 mentor is returned
    const topMentor = mentors.slice(0, 1);
    return NextResponse.json({ mentors: topMentor });
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 500;
    const msg =
      e?.code === "ETIMEDOUT"
        ? "Airtable timed out. Please retry."
        : e?.message || "Server error";
    return NextResponse.json({ error: msg }, { status });
  }
}