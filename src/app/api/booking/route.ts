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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Support both old and new parameter names for backward compatibility
    const bookerId = body.bookerId || body.currentUserId;
    const inviteeId = body.inviteeId || body.invitedUserId;
    const inviteeUsername = body.inviteeUsername || body.invitedUsername;
    const meetingTime = body.meetingTime;
    const notes = body.notes || "";

    // Validate required fields
    if (!bookerId || (!inviteeId && !inviteeUsername) || !meetingTime) {
      return NextResponse.json(
        { error: "Missing required fields: bookerId (or currentUserId), inviteeId (or invitedUserId/inviteeUsername), meetingTime" },
        { status: 400 }
      );
    }

    // Validate meeting time format
    const meetingDate = new Date(meetingTime);
    if (isNaN(meetingDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid meeting time format" },
        { status: 400 }
      );
    }

    // If we have username but no ID, look up the user
    let finalInviteeId = inviteeId;
    if (!finalInviteeId && inviteeUsername) {
      try {
        const userRecords = await base(AIRTABLE_USERS_TABLE!)
          .select({
            filterByFormula: `{Username} = '${inviteeUsername}'`,
            maxRecords: 1
          })
          .firstPage();

        if (userRecords.length === 0) {
          return NextResponse.json(
            { error: "Invitee user not found" },
            { status: 404 }
          );
        }

        finalInviteeId = userRecords[0].fields.UserID as string;
      } catch (error) {
        console.error("Error looking up user by username:", error);
        return NextResponse.json(
          { error: "Error looking up user" },
          { status: 500 }
        );
      }
    }

    // Generate unique booking ID
    const bookingId = nanoid();

    // Fetch user details for both booker and invitee
    let bookerDetails = null;
    let inviteeDetails = null;

    try {
      // Get booker details
      const bookerRecords = await base(AIRTABLE_USERS_TABLE!)
        .select({
          filterByFormula: `{UserID} = '${bookerId}'`,
          maxRecords: 1
        })
        .firstPage();

      if (bookerRecords.length > 0) {
        const bookerFields = bookerRecords[0].fields;
        bookerDetails = {
          username: bookerFields.Username || "",
          email: bookerFields.Email || "",
          name: bookerFields.Name || "",
          tags: bookerFields.Tags || ""
        };
      }

      // Get invitee details
      const inviteeRecords = await base(AIRTABLE_USERS_TABLE!)
        .select({
          filterByFormula: `{UserID} = '${finalInviteeId}'`,
          maxRecords: 1
        })
        .firstPage();

      if (inviteeRecords.length > 0) {
        const inviteeFields = inviteeRecords[0].fields;
        inviteeDetails = {
          username: inviteeFields.Username || "",
          email: inviteeFields.Email || "",
          name: inviteeFields.Name || ""
        };
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      // Continue with booking creation even if user details fetch fails
    }

    // Create booking record
    const bookingRecord = {
      BookingID: bookingId,
      BookedByUserID: bookerId,
      BookerUsername: bookerDetails?.username || "",
      Email: bookerDetails?.email || "",
      InviteeID: finalInviteeId,
      InvitedUsername: inviteeDetails?.username || inviteeUsername || "",
      InvitedEmail: inviteeDetails?.email || "",
      MeetingTime: meetingTime,
      BookingStatus: "Pending", // Default status
      Notes: notes,
      Tags: bookerDetails?.tags || [],
      // ICS file URL for calendar download
      ICSFileUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/booking/${bookingId}/ics`
    };

    // Save to Airtable
    const createdRecord = await base(AIRTABLE_BOOKINGS_TABLE!).create(bookingRecord);

    return NextResponse.json({
      success: true,
      bookingId: bookingId,
      record: createdRecord.fields,
      message: "Booking created successfully."
    });

  } catch (error) {
    console.error("Booking creation error:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}

// GET method to retrieve bookings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const role = searchParams.get("role");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    let filterFormula = "";
    if (role === "mentor") {
      // For mentors, show bookings where they are the invitee
      filterFormula = `{InviteeID} = '${userId}'`;
    } else {
      // For bookers, show bookings where they are the booker
      filterFormula = `{BookedByUserID} = '${userId}'`;
    }

    const bookings = await base(AIRTABLE_BOOKINGS_TABLE!)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: "MeetingTime", direction: "desc" }]
      })
      .all();

    // Format the response using stored user details from booking records
    const formattedBookings = bookings.map((record: any) => ({
      id: record.id,
      bookingId: record.fields.BookingID,
      bookerName: record.fields.BookerUsername || "Unknown",
      bookerEmail: record.fields.BookerEmail || "",
      inviteeName: record.fields.InvitedUsername || "Unknown", 
      inviteeEmail: record.fields.InvitedEmail || "",
      meetingTime: record.fields.MeetingTime,
      status: record.fields.BookingStatus,
      notes: record.fields.Notes,
      createdAt: record.fields.CreatedAt,
      icsFileUrl: record.fields.ICSFileUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/booking/${record.fields.BookingID}/ics`
    }));

    return NextResponse.json({ bookings: formattedBookings });

  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}
