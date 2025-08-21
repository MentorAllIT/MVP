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
    const BOOKINGS = process.env.AIRTABLE_BOOKINGS_TABLE;
    
    if (!base || !BOOKINGS) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const mentorUserId = searchParams.get("mentorUserId");
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");

    if (!mentorUserId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "mentorUserId, startTime, and endTime parameters are required" },
        { status: 400 }
      );
    }

    // Get all confirmed/pending bookings for the mentor within the time range
    const bookings = await base(BOOKINGS)
      .select({
        filterByFormula: `AND(
          {InviteeID} = '${esc(mentorUserId)}',
          OR(
            {BookingStatus} = 'Confirmed',
            {BookingStatus} = 'Pending'
          ),
          IS_AFTER({MeetingTime}, '${startTime}'),
          IS_BEFORE({MeetingTime}, '${endTime}')
        )`,
        fields: ['BookingID', 'MeetingTime', 'BookingStatus']
      })
      .firstPage();

    const bookedTimes = bookings.map(record => ({
      bookingId: record.fields.BookingID,
      meetingTime: record.fields.MeetingTime,
      status: record.fields.BookingStatus
    }));

    return NextResponse.json({
      success: true,
      bookedTimes: bookedTimes
    });

  } catch (error) {
    console.error("Error checking booking conflicts:", error);
    return NextResponse.json(
      { error: "Failed to check booking conflicts" },
      { status: 500 }
    );
  }
}
