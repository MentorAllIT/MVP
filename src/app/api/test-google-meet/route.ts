import { NextRequest, NextResponse } from "next/server";
import { GoogleMeetService, getGoogleAccessToken } from "../../../lib/googlemeet";

// Test route for Google Meet integration
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { status } = body;

    if (status !== 1) {
      return NextResponse.json({ error: "Only testing confirmation (status=1)" }, { status: 400 });
    }

    console.log("Testing Google Meet creation...");

    // Debug environment variables
    console.log("Service Account Email:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "✓ Found" : "✗ Missing");
    console.log("Service Account Key:", process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? "✓ Found" : "✗ Missing");
    
    // More detailed debugging
    console.log("Email value:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log("Key length:", process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.length || 0);
    console.log("Key starts with:", process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.substring(0, 50) || "N/A");

    // Test Google Meet creation without Airtable
    try {
      // Get Google access token and create service
      const googleAccessToken = await getGoogleAccessToken();
      console.log("Got Google access token");
      
      const googleMeetService = new GoogleMeetService(googleAccessToken);

      // Create test meeting data
      const meetingTitle = "Test Meeting: Booking Confirmation";
      const meetingDescription = "Test Google Meet integration for MentorAll booking system";
      const testMeetingTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      const testAttendees = ["test@example.com", "mentor@example.com"];

      console.log("Creating Google Meet event...");

      // Create Google Meet event on service account's own calendar
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
      const meetResult = await googleMeetService.createMeeting(serviceAccountEmail, {
        title: meetingTitle,
        startTime: testMeetingTime,
        duration: 60, // 1 hour meeting
        description: meetingDescription,
        // Remove attendees to avoid Domain-Wide Delegation requirement
        // attendees: testAttendees.map(email => ({ email }))
      });

      console.log("Google Meet created successfully:", meetResult);

      return NextResponse.json({
        success: true,
        message: "Google Meet test successful!",
        googleMeet: meetResult,
        testData: {
          title: meetingTitle,
          description: meetingDescription,
          time: testMeetingTime,
          attendees: testAttendees
        }
      });

    } catch (googleError) {
      console.error("Google Meet creation error:", googleError);
      return NextResponse.json({
        error: "Google Meet creation failed",
        details: googleError instanceof Error ? googleError.message : String(googleError)
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Test booking error:", error);
    return NextResponse.json(
      { error: "Test failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
