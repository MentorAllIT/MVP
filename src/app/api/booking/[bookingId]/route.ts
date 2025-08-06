import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

// Environment variables guard
const { 
  AIRTABLE_API_KEY, 
  AIRTABLE_BASE_ID, 
  AIRTABLE_BOOKINGS_TABLE 
} = process.env;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_BOOKINGS_TABLE) {
  throw new Error("Missing Airtable environment variables");
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const BOOKINGS_TABLE = AIRTABLE_BOOKINGS_TABLE;

// Helper function to escape strings for Airtable formulas
const esc = (s: string) => s.replace(/'/g, "\\'");

// PATCH method to update booking status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const { bookingId } = params;
    const { status } = await req.json();

    // Validate required fields
    if (!bookingId || status === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: bookingId (in URL) and status are required" },
        { status: 400 }
      );
    }

    // Validate status parameter (1 for confirmed, 0 for rejected)
    if (status !== 0 && status !== 1) {
      return NextResponse.json(
        { error: "Invalid status parameter. Use 1 for confirmed, 0 for rejected" },
        { status: 400 }
      );
    }

    // Convert status to booking status string
    const bookingStatus = status === 1 ? "Confirmed" : "Rejected";
    const currentTime = new Date().toISOString();

    // Find the booking record by BookingID
    const existingBookings = await base(BOOKINGS_TABLE)
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

    // Check if booking is already confirmed or rejected
    const currentStatus = bookingRecord.fields.BookingStatus as string;
    if (currentStatus === "Confirmed" || currentStatus === "Rejected") {
      return NextResponse.json(
        { error: `Booking is already ${currentStatus.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Update the booking status and confirmation time
    const updatedRecord = await base(BOOKINGS_TABLE).update([
      {
        id: bookingRecord.id,
        fields: {
          BookingStatus: bookingStatus,
          ConfirmationTime: currentTime,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      message: `Booking ${bookingStatus.toLowerCase()} successfully`,
      booking: {
        bookingId: bookingId,
        status: bookingStatus,
        confirmationTime: currentTime,
        recordId: updatedRecord[0].id,
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
export async function GET(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const { bookingId } = params;

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId parameter is required" },
        { status: 400 }
      );
    }

    // Find the booking record by BookingID
    const existingBookings = await base(BOOKINGS_TABLE)
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
