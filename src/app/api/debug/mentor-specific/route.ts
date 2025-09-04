import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MENTOR_META_TABLE,
} = process.env;

export async function GET(req: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_MENTOR_META_TABLE) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const mentorId = searchParams.get('mentorId') || 'jKd3VERP8O'; // Default to the mentor we're investigating

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);
    
    // Get the specific mentor record
    const records = await base(AIRTABLE_MENTOR_META_TABLE!)
      .select({
        filterByFormula: `{UserID}='${mentorId}'`,
        fields: ["UserID", "Industry", "YearExp", "Role", "CurrentRole", "SeniorityLevel", "PreviousRoles", "MentoringStyle", "CulturalBackground", "Availability"],
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json({ error: `No mentor record found for ${mentorId}` }, { status: 404 });
    }

    const mentorRecord = records[0];
    const allFields = Object.keys(mentorRecord.fields);
    
    // Get detailed info for each field
    const fieldDetails: { [key: string]: any } = {};
    for (const fieldName of allFields) {
      const value = mentorRecord.fields[fieldName];
      fieldDetails[fieldName] = {
        value: value,
        type: typeof value,
        isNull: value === null,
        isUndefined: value === undefined,
        length: Array.isArray(value) ? value.length : (typeof value === 'string' ? value.length : 'N/A')
      };
    }

    // Check our expected preference fields
    const expectedFields = [
      "CurrentRole", 
      "SeniorityLevel", 
      "PreviousRoles", 
      "MentoringStyle", 
      "CulturalBackground", 
      "Availability"
    ];

    const expectedFieldStatus: { [key: string]: any } = {};
    for (const expectedField of expectedFields) {
      expectedFieldStatus[expectedField] = {
        exists: allFields.includes(expectedField),
        value: mentorRecord.fields[expectedField] || null,
        type: typeof mentorRecord.fields[expectedField],
        isNull: mentorRecord.fields[expectedField] === null,
        isUndefined: mentorRecord.fields[expectedField] === undefined
      };
    }

    return NextResponse.json({
      message: `Mentor ${mentorId} data inspection`,
      mentorId: mentorId,
      totalFields: allFields.length,
      allFields: allFields,
      fieldDetails: fieldDetails,
      expectedFieldsStatus: expectedFieldStatus,
      rawRecord: {
        id: mentorRecord.id,
        fields: mentorRecord.fields
      }
    });

  } catch (error) {
    console.error("Error inspecting specific mentor:", error);
    return NextResponse.json({ 
      error: "Failed to inspect specific mentor",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
