import { NextRequest, NextResponse } from "next/server";

// Mock test endpoint for Calendly integration (without real API calls)
export async function GET() {
  // Mock Calendly user data
  const mockUserData = {
    name: "John Doe",
    email: "john@example.com",
    schedulingUrl: "https://calendly.com/john-doe",
    timezone: "America/New_York",
    uri: "https://api.calendly.com/users/ABCDEF123456"
  };

  return NextResponse.json({
    success: true,
    message: "Mock Calendly API response (replace with real token to test actual API)",
    user: mockUserData,
    note: "This is mock data. Get a real Calendly API token from https://calendly.com/integrations/api_webhooks"
  });
}

// Mock sync endpoint
export async function POST() {
  // Mock sync response
  const mockSyncResult = {
    success: true,
    message: "Mock sync completed",
    syncedBookings: [
      {
        action: "created",
        bookingId: "mock123abc",
        calendlyEventId: "https://api.calendly.com/scheduled_events/MOCK123"
      }
    ],
    totalEvents: 1,
    note: "This is mock data. Configure real Calendly API token to sync actual events"
  };

  return NextResponse.json(mockSyncResult);
}
