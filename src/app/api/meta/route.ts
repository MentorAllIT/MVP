import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

const MENTEE_TABLE = process.env.AIRTABLE_MENTEE_META_TABLE!;
const MENTOR_TABLE = process.env.AIRTABLE_MENTOR_META_TABLE!;
const ATTACH_FIELD = "CV";
const CONTENT_URL  = "https://content.airtable.com/v0";
const esc = (s: string) => s.replace(/'/g, "\\'");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const role = searchParams.get('role');
    
    if (!uid || !role) {
      return NextResponse.json({ error: "Missing uid/role" }, { status: 400 });
    }

    const table = role === "mentee" ? MENTEE_TABLE : MENTOR_TABLE;
    
    // Fetch existing meta data
    const [existing] = await base(table)
      .select({
        filterByFormula: `{UserID} = '${esc(uid)}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing) {
      if (role === "mentee") {
        return NextResponse.json({
          uid: existing.fields.UserID,
          goal: existing.fields.Goal || "",
          challenges: existing.fields.Challenges || "",
          help: existing.fields.HelpNeeded || ""
        });
      } else {
        return NextResponse.json({
          uid: existing.fields.UserID,
          industry: existing.fields.Industry || "",
          years: existing.fields.YearExp || "",
          calendly: existing.fields.Calendly || ""
        });
      }
    } else {
      // No meta data found, return empty
      if (role === "mentee") {
        return NextResponse.json({
          uid,
          goal: "",
          challenges: "",
          help: ""
        });
      } else {
        return NextResponse.json({
          uid,
          industry: "",
          years: "",
          calendly: ""
        });
      }
    }
  } catch (err: any) {
    console.error("meta GET route:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const fd   = await req.formData();
    const uid  = fd.get("uid")   as string | null;
    const role = fd.get("role")  as string | null;

    if (!uid || !role) {
      return NextResponse.json({ error: "Missing uid/role" }, { status: 400 });
    }

    const table = role === "mentee" ? MENTEE_TABLE : MENTOR_TABLE;
    const fields: Record<string, any> = { UserID: uid };

    if (role === "mentee") {
        fields.Goal       = fd.get("goal")       as string;
        fields.Challenges = fd.get("challenges") as string;
        fields.HelpNeeded = fd.get("help")       as string;
    } else {
      fields.Industry = fd.get("industry") as string;
      fields.YearExp  = Number(fd.get("years") as string);
      fields.Calendly = fd.get("calendly") as string;
    }

    // find existing row
    const [existing] = await base(table)
      .select({
        filterByFormula: `{UserID} = '${esc(uid)}'`,
        maxRecords: 1,
      })
      .firstPage();

    let recId: string;
    if (existing) {
      recId = existing.id;
      await base(table).update(recId, fields);
    } else {
      const created = await base(table).create([{ fields }]);
      recId = created[0].id;
    }

    if (role === "mentee") {
      const file = fd.get("cv") as File | null;
      if (!file) {
        return NextResponse.json({ error: "Missing CV file" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const b64 = buffer.toString("base64");

      const res = await fetch(
        `${CONTENT_URL}/${process.env.AIRTABLE_BASE_ID}/${recId}/${ATTACH_FIELD}/uploadAttachment`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            file: b64,
          }),
        }
      );

      if (!res.ok) {
        console.error("Airtable uploadAttachment failed:", await res.text());
        return NextResponse.json(
          { error: "Failed to upload CV to Airtable" },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("meta route:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}