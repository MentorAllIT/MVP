import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MENTEE_META_TABLE,
} = process.env;

export async function GET(req: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_MENTEE_META_TABLE) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const menteeId = searchParams.get('menteeId') || 'UDk1QK6HZ1'; // Default to the mentee we're investigating

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);
    
    // Get the specific mentee record from MenteeMeta table
    const records = await base(AIRTABLE_MENTEE_META_TABLE!)
      .select({
        filterByFormula: `{UserID}='${menteeId}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json({ error: `No mentee record found for ${menteeId}` }, { status: 404 });
    }

    const menteeRecord = records[0];
    const allFields = Object.keys(menteeRecord.fields);
    
    // Get detailed info for each field
    const fieldDetails: { [key: string]: any } = {};
    for (const fieldName of allFields) {
      const value = menteeRecord.fields[fieldName];
      fieldDetails[fieldName] = {
        value: value,
        type: typeof value,
        isNull: value === null,
        isUndefined: value === undefined,
        length: Array.isArray(value) ? value.length : (typeof value === 'string' ? value.length : 'N/A')
      };
    }

    // Check for Tags field specifically
    const tagsField = menteeRecord.fields.Tags;
    const tagsAnalysis = {
      exists: !!tagsField,
      value: tagsField,
      type: typeof tagsField,
      isArray: Array.isArray(tagsField),
      length: Array.isArray(tagsField) ? tagsField.length : 'N/A'
    };

    return NextResponse.json({
      message: "MenteeMeta table inspection",
      menteeId: menteeId,
      allFields: allFields,
      fieldDetails: fieldDetails,
      tagsAnalysis: tagsAnalysis,
      rawTags: tagsField
    });

  } catch (error) {
    console.error("Error in mentee-meta-tags:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
