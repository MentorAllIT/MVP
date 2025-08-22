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
    const uid  = searchParams.get("uid");
    const role = searchParams.get("role");

    if (!uid || !role) {
      return NextResponse.json({ error: "Missing uid/role" }, { status: 400 });
    }

    const table = role === "mentee" ? MENTEE_TABLE : MENTOR_TABLE;

    const [existing] = await base(table)
      .select({ filterByFormula: `{UserID} = '${esc(uid)}'`, maxRecords: 1 })
      .firstPage();

    if (!existing) {
      return NextResponse.json(
        role === "mentee"
          ? { uid, goal: "", challenges: "", help: "", resumeInfo: null }
          : {
              uid,
              industry: "",
              years: "",
              currentRole: "",
              seniorityLevel: "",
              previousRoles: "",
              mentoringStyle: "",
              culturalBackground: "",
              availability: "",
              availabilityJson: "",
            }
      );
    }

    if (role === "mentee") {
      return NextResponse.json({
        uid: existing.fields.UserID || uid,
        goal: existing.fields.Goal || "",
        challenges: existing.fields.Challenges || "",
        help: existing.fields.HelpNeeded || "",
        resumeInfo: existing.fields['Resume Info'] ? JSON.parse(String(existing.fields['Resume Info'])) : null,
      });
    } else {
      return NextResponse.json({
        uid: existing.fields.UserID || uid,
        industry: existing.fields.Industry || "",
        years: existing.fields.YearExp ?? "",
        currentRole: existing.fields.CurrentRole || "",
        seniorityLevel: existing.fields.SeniorityLevel || "",
        previousRoles: existing.fields.PreviousRoles || "",
        mentoringStyle: existing.fields.MentoringStyle || "",
        culturalBackground: existing.fields.CulturalBackground || "",
        availability: existing.fields.Availability || "",
        availabilityJson: existing.fields.AvailabilityJSON || "",
      });
    }
  } catch (e) {
    console.error("meta GET route:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const fd   = await req.formData();
    const uid  = fd.get("uid")   as string | null;
    const role = fd.get("role")  as string | null;
    console.log(fd)

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

      fields.CurrentRole        = fd.get("currentRole") as string;
      fields.SeniorityLevel     = fd.get("seniorityLevel") as string;
      fields.PreviousRoles      = fd.get("previousRoles") as string;
      fields.MentoringStyle     = fd.get("mentoringStyle") as string;
      fields.CulturalBackground = fd.get("culturalBackground") as string;
      fields.Availability       = fd.get("availability") as string;

      const availabilityJson = fd.get("availabilityJson") as string | null;
      if (!availabilityJson) {
        return NextResponse.json({ error: "Missing availabilityJson" }, { status: 400 });
      }

      // Validate & store JSON blob
      try {
        JSON.parse(availabilityJson);
      } catch {
        return NextResponse.json({ error: "Invalid availabilityJson (must be JSON)" }, { status: 400 });
      }

      fields.AvailabilityJSON = availabilityJson;
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
      const keepExisting = fd.get("keepExistingResume") === "true";
      
      if (!file && !keepExisting) {
        return NextResponse.json({ error: "Missing CV file" }, { status: 400 });
      }

      if (file) {
        // New file uploaded
        const buffer = Buffer.from(await file.arrayBuffer());
        const b64 = buffer.toString("base64");

        // Store resume metadata
        const resumeInfo = {
          filename: file.name,
          uploadDate: new Date().toISOString(),
          fileSize: file.size,
          contentType: file.type
        };

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

        // Update the record with resume metadata
        await base(table).update(recId, { 'Resume Info': JSON.stringify(resumeInfo) });
      }
      // If keepExisting is true, we don't need to do anything - the existing resume stays
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("meta route:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}