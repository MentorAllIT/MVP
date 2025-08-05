import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

const PROFILES = process.env.AIRTABLE_PROFILES_TABLE!;
const esc = (s: string) => s.replace(/'/g, "\\'");

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const uid      = form.get("uid")      as string | null;
    const bio      = form.get("bio")      as string | null;
    const linkedin = form.get("linkedin") as string | null;

    if (!uid || !bio || !linkedin) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Profile already exist for this uid?
    const [row] = await base(PROFILES)
      .select({ filterByFormula: `{UserID} = '${esc(uid)}'`, maxRecords: 1 })
      .firstPage();

    if (row) {
      await base(PROFILES).update(row.id, { Bio: bio, LinkedIn: linkedin });
    } else {
      await base(PROFILES).create([
        { fields: { UserID: uid, Bio: bio, LinkedIn: linkedin } },
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("profile route:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
