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

    // Select different fields based on role
    const menteeFields = ['UserID', 'Goal', 'Challenges', 'HelpNeeded', 'Resume Info'];
    const mentorFields = ['UserID', 'Industry', 'YearExp', 'CurrentRole', 'CurrentCompany', 'SeniorityLevel', 'PreviousRoles', 'RequiredMentoringStyles', 'CulturalBackground', 'Availability', 'AvailabilityJSON'];
    
    const fieldsToSelect = role === "mentee" ? menteeFields : mentorFields;
    
    const [existing] = await base(table)
      .select({ 
        filterByFormula: `{UserID} = '${esc(uid)}'`, 
        maxRecords: 1,
        fields: fieldsToSelect
      })
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
              currentCompany: "",
              seniorityLevel: "",
              previousRoles: "",
              mentoringStyle: "",
              requiredMentoringStyles: "",
              culturalBackground: "",
              availability: "",
              availabilityJson: "",
            }
      );
    }

    // Debug: Log what fields are actually available (only for mentors)
    if (role === "mentor") {
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
      // Handle mentoring style fields for mentors - only use RequiredMentoringStyles
      let mentoringStyle = "";
      let requiredMentoringStyles = "";

      // Handle RequiredMentoringStyles field (Multiple select)
      if (Array.isArray(existing.fields.RequiredMentoringStyles)) {
        // Check if it has the specific "I don't have any particular" option
        if (existing.fields.RequiredMentoringStyles.includes("I don't have any particular mentoring style")) {
          mentoringStyle = "dont_mind";
          requiredMentoringStyles = "dont_mind";
        } else if (existing.fields.RequiredMentoringStyles.length > 0) {
          // Map styles back to IDs for frontend
          const reverseStyleMap: Record<string, string> = {
            'Coaching': 'coaching',
            'Role Modelling': 'roleModelling',
            'Facilitative': 'facilitative', 
            'Technical': 'technical',
            'Holistic': 'holistic'
          };
          const mappedStyles = existing.fields.RequiredMentoringStyles
            .map(style => reverseStyleMap[style] || style);
          
          // Set the first style as the main mentoring style and all styles as required
          mentoringStyle = mappedStyles[0] || "";
          requiredMentoringStyles = mappedStyles.join(', ');
        }
      }

      return NextResponse.json({
        uid: existing.fields.UserID || uid,
        industry: existing.fields.Industry || "",
        years: existing.fields.YearExp ?? "",
        currentRole: existing.fields.CurrentRole || "",
        currentCompany: existing.fields.CurrentCompany || "",
        seniorityLevel: existing.fields.SeniorityLevel || "",
        previousRoles: existing.fields.PreviousRoles || "",
        mentoringStyle: mentoringStyle, // Keep for backward compatibility with frontend
        requiredMentoringStyles: requiredMentoringStyles,
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
    
    // Debug: Log all FormData entries
    for (const [key, value] of fd.entries()) {
      console.log(`  ${key}: ${value}`);
    }

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
      fields.CurrentCompany     = fd.get("currentCompany") as string;
      fields.SeniorityLevel     = fd.get("seniorityLevel") as string;
      fields.PreviousRoles      = fd.get("previousRoles") as string;
      const requiredMentoringStylesValue = fd.get("requiredMentoringStyles") as string;
      
      // Handle mentoring style for mentors - use RequiredMentoringStyles field
      if (requiredMentoringStylesValue && requiredMentoringStylesValue.trim()) {
        if (requiredMentoringStylesValue === 'dont_mind') {
          // When mentor selects "I don't mind", save the exact field name to RequiredMentoringStyles
          fields.RequiredMentoringStyles = ["I don't have any particular mentoring style"];
        } else {
          // Convert comma-separated styles to array for RequiredMentoringStyles field
          const styleMap: Record<string, string> = {
            'coaching': 'Coaching',
            'roleModelling': 'Role Modelling', 
            'facilitative': 'Facilitative',
            'technical': 'Technical',
            'holistic': 'Holistic'
          };
          
          const styles = requiredMentoringStylesValue.split(',').map(s => s.trim()).filter(s => s);
          const normalizedStyles = styles.map(style => styleMap[style] || style);
          fields.RequiredMentoringStyles = normalizedStyles; // Send as array for Multiple select
        }
      }
      // Note: Mentoring style is already handled above using RequiredMentoringStyles field
      
      // Note: Mentors don't have NiceToHaveStyles field - only RequiredMentoringStyles
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
    
    if (existing) {
    }

    
    let recId: string;
    try {
      if (existing) {
        recId = existing.id;
        await base(table).update(recId, fields);
      } else {
        const created = await base(table).create([{ fields }]);
        recId = created[0].id;
      }
    } catch (airtableError) {
      console.error("❌ Airtable error:", airtableError);
      return NextResponse.json(
        { 
          error: "Failed to save to database", 
          details: airtableError instanceof Error ? airtableError.message : "Unknown error",
          fields: fields
        }, 
        { status: 500 }
      );
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