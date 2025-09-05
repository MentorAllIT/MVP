import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    console.log("=== TEST MENTEE PREFERENCES API ===");
    
    // Test 1: Check if we can receive FormData
    console.log("Step 1: Testing FormData parsing...");
    const formData = await request.formData();
    console.log("FormData received successfully");
    
    // Test 2: Extract basic fields
    console.log("Step 2: Extracting form fields...");
    const uid = formData.get('uid') as string;
    const role = formData.get('role') as string;
    const currentIndustry = formData.get('currentIndustry') as string;
    const yearsExperience = formData.get('yearsExperience') as string;
    
    console.log("Extracted fields:", {
      uid: !!uid,
      role: !!role,
      currentIndustry: !!currentIndustry,
      yearsExperience: !!yearsExperience
    });
    
    // Test 3: Check environment variables
    console.log("Step 3: Checking environment variables...");
    const envCheck = {
      AIRTABLE_API_KEY: !!process.env.AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID: !!process.env.AIRTABLE_BASE_ID,
      AIRTABLE_MENTEE_PREFERENCES_TABLE: !!process.env.AIRTABLE_MENTEE_PREFERENCES_TABLE,
      JWT_SECRET: !!process.env.JWT_SECRET,
    };
    console.log("Environment variables:", envCheck);
    
    // Test 4: Basic validation
    console.log("Step 4: Basic validation...");
    if (!uid) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    if (!yearsExperience || yearsExperience === "0") {
      return NextResponse.json({ error: "Years of experience is required" }, { status: 400 });
    }
    
    const yearsValue = parseInt(yearsExperience);
    if (isNaN(yearsValue) || yearsValue <= 0) {
      return NextResponse.json({ error: "Years of experience must be a valid number" }, { status: 400 });
    }
    
    // Test 5: Return success with all data
    console.log("Step 5: All tests passed!");
    return NextResponse.json({
      success: true,
      message: "Test mentee preferences API working",
      data: {
        uid,
        role,
        currentIndustry,
        yearsExperience: yearsValue,
        envCheck
      }
    });
    
  } catch (error) {
    console.error("Test API error:", error);
    return NextResponse.json({
      error: "Test API failed",
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
