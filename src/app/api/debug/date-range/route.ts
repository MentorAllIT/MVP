import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Calculate yesterday's date range in AEST - same logic as the cron job
    const now = new Date();
    
    // Get today's date in AEST
    const todayAEST = new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
    
    // Calculate yesterday in AEST
    const yesterdayAEST = new Date(todayAEST);
    yesterdayAEST.setDate(yesterdayAEST.getDate() - 1);
    
    // Set to start of day (00:00:00) and end of day (23:59:59) in AEST
    const yesterdayStart = new Date(yesterdayAEST);
    yesterdayStart.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterdayAEST);
    yesterdayEnd.setHours(23, 59, 59, 999);

    return NextResponse.json({
      currentTime: {
        utc: now.toISOString(),
        aest: todayAEST.toISOString(),
        aestFormatted: todayAEST.toLocaleString("en-AU", { 
          timeZone: "Australia/Sydney",
          dateStyle: "full",
          timeStyle: "long"
        })
      },
      yesterdayCalculation: {
        yesterdayAEST: yesterdayAEST.toISOString(),
        yesterdayDateOnly: yesterdayAEST.toISOString().split('T')[0],
        rangeStart: yesterdayStart.toISOString(),
        rangeEnd: yesterdayEnd.toISOString(),
        rangeStartFormatted: yesterdayStart.toLocaleString("en-AU", { 
          timeZone: "Australia/Sydney" 
        }),
        rangeEndFormatted: yesterdayEnd.toLocaleString("en-AU", { 
          timeZone: "Australia/Sydney" 
        })
      },
      explanation: {
        message: "This shows the date range that the cron job will search for bookings",
        expectedBehavior: "Should find meetings from 00:00:00 to 23:59:59 yesterday (AEST)",
        currentLogic: "Directly comparing AEST dates without UTC conversion"
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { 
        error: "Failed to calculate date range", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
