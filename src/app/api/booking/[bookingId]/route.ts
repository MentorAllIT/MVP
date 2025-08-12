import { NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";
const getBase = () => {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  return AIRTABLE_API_KEY && AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)
    : null;
};

// Helper function to escape strings for Airtable formulas
const esc = (s: string) => s.replace(/'/g, "\\'");

// Extract /api/booking/[bookingId]
const getBookingId = (req: Request) => {
  const m = new URL(req.url).pathname.match(/\/api\/booking\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : "";
};

// PATCH method to update booking status
export async function PATCH(req: Request) {
  try {
    const base = getBase();
    const table = process.env.AIRTABLE_BOOKINGS_TABLE;
    if (!base || !table) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }
    
    const bookingId = getBookingId(req).trim();
    const { status, newMeetingTime } = await req.json();

    // Validate required fields
    if (!bookingId || status === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: bookingId (in URL) and status are required" },
        { status: 400 }
      );
    }

    // Validate status parameter (1 for confirmed, 2 for rescheduled)
    if (status !== 1 && status !== 2) {
      return NextResponse.json(
        { error: "Invalid status parameter. Use 1 for confirmed, 2 for rescheduled" },
        { status: 400 }
      );
    }

    // If rescheduling, validate new meeting time
    if (status === 2) {
      if (!newMeetingTime) {
        return NextResponse.json(
          { error: "newMeetingTime is required when rescheduling" },
          { status: 400 }
        );
      }

      // Validate new meeting time format and ensure it's in the future
      const newMeetingDate = new Date(newMeetingTime);
      if (isNaN(newMeetingDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid newMeetingTime format" },
          { status: 400 }
        );
      }

      if (newMeetingDate <= new Date()) {
        return NextResponse.json(
          { error: "New meeting time must be in the future" },
          { status: 400 }
        );
      }
    }

    // Convert status to booking status string
    const bookingStatus = status === 1 ? "Confirmed" : "Rescheduled";
    const currentTime = new Date().toISOString();

    // Find the booking record by BookingID
    const existingBookings = await base(table)
      .select({
        filterByFormula: `{BookingID} = '${esc(bookingId)}'`,
        maxRecords: 1
      })
      .firstPage();

    if (existingBookings.length === 0) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const bookingRecord = existingBookings[0];

    // Check if booking is already confirmed or rescheduled
    const currentStatus = bookingRecord.fields.BookingStatus as string;
    if (currentStatus === "Confirmed" || currentStatus === "Rescheduled") {
      return NextResponse.json(
        { error: `Booking is already ${currentStatus.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Prepare update fields
    const updateFields: { [key: string]: string | number } = {
      BookingStatus: bookingStatus,
      ConfirmationTime: currentTime,
    };

    // If rescheduling, update the meeting time
    if (status === 2) {
      updateFields.MeetingTime = newMeetingTime;
    }

    // Update the booking status and confirmation time
    const updatedRecord = await base(table).update([
      {
        id: bookingRecord.id,
        fields: updateFields,
      },
    ]);

    return NextResponse.json({
      success: true,
      message: status === 1 
        ? `Booking confirmed successfully` 
        : `Booking rescheduled successfully to ${new Date(newMeetingTime || bookingRecord.fields.MeetingTime).toLocaleString()}`,
      booking: {
        bookingId: bookingId,
        status: bookingStatus,
        confirmationTime: currentTime,
        meetingTime: status === 2 ? newMeetingTime : bookingRecord.fields.MeetingTime,
        recordId: updatedRecord[0]?.id,
      }
    });

  } catch (err: any) {
    console.error("Booking status update error:", err);
    
    // Handle specific Airtable errors
    if (err.statusCode === 422) {
      return NextResponse.json(
        { error: "Invalid data format for Airtable" },
        { status: 422 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET method to retrieve a specific booking by ID
export async function GET(req: Request) {
  try {
    const base = getBase();
    const table = process.env.AIRTABLE_BOOKINGS_TABLE;
    if (!base || !table) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }
    const bookingId = getBookingId(req).trim();

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId parameter is required" },
        { status: 400 }
      );
    }

    // Find the booking record by BookingID
    const existingBookings = await base(table)
      .select({
        filterByFormula: `{BookingID} = '${esc(bookingId)}'`,
        maxRecords: 1
      })
      .firstPage();

    if (existingBookings.length === 0) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const bookingRecord = existingBookings[0];

    return NextResponse.json({
      success: true,
      booking: {
        id: bookingRecord.id,
        ...bookingRecord.fields
      }
    });

  } catch (err: any) {
    console.error("Booking retrieval error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
