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

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);
    
    // Get a few mentor records to inspect their fields
    const records = await base(AIRTABLE_MENTOR_META_TABLE!)
      .select({
        fields: ["UserID", "Industry", "YearExp", "Role"],
        maxRecords: 5
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json({ error: "No mentor records found" }, { status: 404 });
    }

    // Inspect the first record to see all available fields
    const firstRecord = records[0];
    const allFields = Object.keys(firstRecord.fields);
    
    // Get sample data for each field
    const fieldSamples: { [key: string]: any } = {};
    for (const fieldName of allFields) {
      fieldSamples[fieldName] = firstRecord.fields[fieldName];
    }

    // Check if our expected fields exist
    const expectedFields = [
      "CurrentRole", 
      "SeniorityLevel", 
      "PreviousRoles", 
      "MentoringStyle", 
      "CulturalBackground", 
      "Availability"
    ];

    const fieldStatus: { [key: string]: any } = {};
    for (const expectedField of expectedFields) {
      fieldStatus[expectedField] = {
        exists: allFields.includes(expectedField),
        value: firstRecord.fields[expectedField] || null,
        type: typeof firstRecord.fields[expectedField]
      };
    }

    return NextResponse.json({
      message: "Mentor fields inspection",
      totalFields: allFields.length,
      allFields: allFields,
      fieldSamples: fieldSamples,
      expectedFieldsStatus: fieldStatus,
      sampleRecord: {
        id: firstRecord.id,
        fields: firstRecord.fields
      }
    });

  } catch (error) {
    console.error("Error inspecting mentor fields:", error);
    return NextResponse.json({ 
      error: "Failed to inspect mentor fields",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
