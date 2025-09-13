import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_MENTEE_PREFERENCES_TABLE } = process.env;

export async function GET() {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_MENTEE_PREFERENCES_TABLE) {
      return NextResponse.json({ error: "Missing Airtable configuration" }, { status: 500 });
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    
    // Get a sample record to see what fields are available
    const records = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE).select({
      maxRecords: 1
    }).firstPage();

    if (records.length === 0) {
      return NextResponse.json({ error: "No records found" }, { status: 404 });
    }

    const record = records[0];
    const fields = record.fields;

    return NextResponse.json({
      availableFields: Object.keys(fields),
      mentoringStyleFields: {
        MentoringStyle: fields.MentoringStyle,
        RequiredMentoringStyles: fields.RequiredMentoringStyles,
        NicetohaveStyles: fields.NicetohaveStyles
      },
      allFields: fields
    });

  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch field information",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
