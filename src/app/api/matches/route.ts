import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

const USERS     = process.env.AIRTABLE_USERS_TABLE!;
const PROFILES  = process.env.AIRTABLE_PROFILES_TABLE!;
const MATCHES   = process.env.AIRTABLE_MATCH_TABLE!;
const esc = (s: string) => s.replace(/'/g, "\\'");

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ mentors: [] });

    /* 1 — rows where this mentee is paired */
    const matchRows = await base(MATCHES)
      .select({ filterByFormula: `{MenteeID} = '${esc(uid)}'` })
      .all();

    if (!matchRows.length) return NextResponse.json({ mentors: [] });

    const mentorIds = matchRows.map(r => r.get("MentorID") as string);

    /* 2 — look up each mentor’s name + bio in parallel */
    const mentors = await Promise.all(
      mentorIds.map(async id => {
        const [userRow] = await base(USERS)
          .select({ filterByFormula: `{UserID} = '${esc(id)}'`, maxRecords: 1 })
          .firstPage();

        const [profileRow] = await base(PROFILES)
          .select({ filterByFormula: `{UserID} = '${esc(id)}'`, maxRecords: 1 })
          .firstPage();

        return {
          uid: id,
          name:    userRow?.get("Name")  ?? "Unnamed mentor",
          bio:     profileRow?.get("Bio") ?? "",
        };
      })
    );

    return NextResponse.json({ mentors });
  } catch (err: any) {
    console.error("matches route:", err);
    return NextResponse.json({ mentors: [] });
  }
}
