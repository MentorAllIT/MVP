import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";

const getBase = () => {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  return AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;
};

const esc = (s: string) => String(s).replace(/'/g, "\\'");

export async function GET(request: NextRequest) {
  try {
    const base = getBase();
    const MENTOR_META = process.env.AIRTABLE_MENTOR_META_TABLE || "MentorMeta";
    
    if (!base) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "UserId parameter is required" },
        { status: 400 }
      );
    }

    // Fetch mentor availability from MentorMeta table using UserID
    const records = await base(MENTOR_META)
      .select({
        filterByFormula: `{UserID} = '${esc(userId)}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json(
        { error: "Mentor not found or availability not configured" },
        { status: 404 }
      );
    }

    const mentorRecord = records[0];
    const availabilityJSON = mentorRecord.fields.AvailabilityJSON as string;

    if (!availabilityJSON) {
      return NextResponse.json(
        { error: "Mentor availability not configured" },
        { status: 404 }
      );
    }

    try {
      const availability = JSON.parse(availabilityJSON);
      
      // Validate the availability structure
      if (!availability.timezone || !availability.weekly) {
        return NextResponse.json(
          { error: "Invalid availability format" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        availability: availability,
        mentorInfo: {
          userId: mentorRecord.fields.UserID,
          username: mentorRecord.fields.Username,
          name: mentorRecord.fields.Name || mentorRecord.fields.Username || "Unknown"
        }
      });

    } catch (parseError) {
      console.error("Error parsing availability JSON:", parseError);
      return NextResponse.json(
        { error: "Invalid availability JSON format" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Error fetching mentor availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch mentor availability" },
      { status: 500 }
    );
  }
}
