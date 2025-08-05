import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

const MENTEE = process.env.AIRTABLE_MENTEE_META_TABLE!;
const MENTOR = process.env.AIRTABLE_MENTOR_META_TABLE!;
const esc = (s: string) => s.replace(/'/g, "\\'");

export async function POST(req: NextRequest) {
  try {
    const fd   = await req.formData();
    const uid  = fd.get("uid")   as string | null;
    const role = fd.get("role")  as string | null;

    if (!uid || !role) {
      return NextResponse.json({ error: "Missing uid/role" }, { status: 400 });
    }

    if (role === "mentee") {
      const goal       = fd.get("goal")       as string | null;
      const challenges = fd.get("challenges") as string | null;
      const help       = fd.get("help")       as string | null;

      if (!goal || !challenges || !help)
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });

      await upsert(MENTEE, uid, { Goal: goal, Challenges: challenges, HelpNeeded: help });
    } else if (role === "mentor") {
      const industry  = fd.get("industry")  as string | null;
      const years     = fd.get("years")     as string | null;
      const calendly  = fd.get("calendly")  as string | null;

      if (!industry || !years || !calendly)
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });

      await upsert(MENTOR, uid, {
        Industry: industry,
        YearExp: Number(years),
        Calendly: calendly,
      });
    } else {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("meta route:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function upsert(table: string, uid: string, fields: Record<string, any>) {
  const [row] = await base(table)
    .select({ filterByFormula: `{UserID} = '${esc(uid)}'`, maxRecords: 1 })
    .firstPage();

  if (row) await base(table).update(row.id, fields);
  else      await base(table).create([{ fields: { UserID: uid, ...fields } }]);
}
