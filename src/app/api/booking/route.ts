import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import { nanoid } from "nanoid";

// Environment variables guard
const { 
  AIRTABLE_API_KEY, 
  AIRTABLE_BASE_ID, 
  AIRTABLE_USERS_TABLE, 
  AIRTABLE_BOOKINGS_TABLE 
} = process.env;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_USERS_TABLE || !AIRTABLE_BOOKINGS_TABLE) {
  throw new Error("Missing Airtable environment variables");
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const USERS_TABLE = AIRTABLE_USERS_TABLE;
const BOOKINGS_TABLE = AIRTABLE_BOOKINGS_TABLE;

// Helper function to escape strings for Airtable formulas
const esc = (s: string) => s.replace(/'/g, "\\'");

// Helper function to get user details by UserID
async function getUserById(userId: string) {
  try {
    const records = await base(USERS_TABLE)
      .select({ 
        filterByFormula: `{UserID} = '${esc(userId)}'`, 
        maxRecords: 1 
      })
      .firstPage();
    
    if (records.length === 0) {
      return null;
    }
    
    const user = records[0].fields;
    return {
      name: user.Name as string,
      email: user.Email as string,
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { bookerId, inviteeId, meetingTime } = await req.json();

    // Validate required fields
    if (!bookerId || !inviteeId || !meetingTime) {
      return NextResponse.json(
        { error: "Missing required fields: bookerId, inviteeId, and meetingTime are required" },
        { status: 400 }
      );
    }

    // Validate meeting time format
    const meetingDate = new Date(meetingTime);
    if (isNaN(meetingDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid meetingTime format. Please provide a valid ISO date string" },
        { status: 400 }
      );
    }

    // Check if meetingTime is in the future
    if (meetingDate <= new Date()) {
      return NextResponse.json(
        { error: "Meeting time must be in the future" },
        { status: 400 }
      );
    }

    // Get booker details
    const booker = await getUserById(bookerId);
    if (!booker) {
      return NextResponse.json(
        { error: "Booker not found" },
        { status: 404 }
      );
    }

    // Get invitee details
    const invitee = await getUserById(inviteeId);
    if (!invitee) {
      return NextResponse.json(
        { error: "Invitee not found" },
        { status: 404 }
      );
    }

    // Check if the booker and invitee are the same person
    if (bookerId === inviteeId) {
      return NextResponse.json(
        { error: "Cannot book a meeting with yourself" },
        { status: 400 }
      );
    }

    // Generate unique booking ID
    const bookingId = nanoid(12);

    // Create booking record in Airtable
    const bookingRecord = await base(BOOKINGS_TABLE).create([
      {
        fields: {
          BookingID: bookingId,
          BookedByUserID: bookerId,
          InvitedUserID: inviteeId,
          MeetingTime: meetingDate.toISOString(),
          BookingStatus: "Pending",
          // ConfirmationTime: Will be set when booking is confirmed
          Notes: "", // Empty for now
          BookerUsername: booker.name,
          InvitedUsername: invitee.name,
          Email: booker.email,
          InvitedEmail: invitee.email,
        },
      },
    ]);

    return NextResponse.json(
      { 
        success: true,
        bookingId: bookingId,
        message: "Booking created successfully",
        booking: {
          bookingId,
          bookerId,
          inviteeId,
          meetingTime: meetingDate.toISOString(),
          status: "Pending",
          bookerName: booker.name,
          inviteeName: invitee.name,
        }
      },
      { status: 201 }
    );

  } catch (err: any) {
    console.error("Booking creation error:", err);
    
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

// GET method to retrieve bookings (optional - for future use)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    // Get bookings where user is either booker or invitee
    const bookings = await base(BOOKINGS_TABLE)
      .select({
        filterByFormula: `OR({BookedByUserID} = '${esc(userId)}', {InvitedUserID} = '${esc(userId)}')`,
        sort: [{ field: 'MeetingTime', direction: 'desc' }]
      })
      .firstPage();

    const formattedBookings = bookings.map(record => ({
      id: record.id,
      ...record.fields
    }));

    return NextResponse.json({
      success: true,
      bookings: formattedBookings
    });

  } catch (err: any) {
    console.error("Booking retrieval error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
