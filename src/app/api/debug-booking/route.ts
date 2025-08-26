import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

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
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'BookingId is required' },
        { status: 400 }
      );
    }

    const booking = await base(BOOKINGS)
      .select({
        filterByFormula: `{BookingID} = '${esc(bookingId)}'`,
        maxRecords: 1
      })
      .firstPage();

    if (booking.length === 0) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const record = booking[0];
    const googleMeetField = record.fields.GoogleMeetJoinUrl;

    const debugInfo = {
      bookingId,
      googleMeetJoinUrl: {
        raw: googleMeetField,
        type: typeof googleMeetField,
        jsonStringified: JSON.stringify(googleMeetField)
      }
    };

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
