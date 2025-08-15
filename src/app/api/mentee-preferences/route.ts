import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MENTEE_PREFERENCES_TABLE,
  JWT_SECRET,
} = process.env;

const ready = AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_MENTEE_PREFERENCES_TABLE;

let base: any = null;
if (ready) base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);

const esc = (s: string) => String(s).replace(/'/g, "\\'");
const nowISO = () => new Date().toISOString();

export async function GET(request: NextRequest) {
  try {
    if (!ready) {
      return NextResponse.json(
        { error: "Backend not configured - missing Airtable credentials" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    
    if (!uid) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Fetch existing preferences data
    const existingRecords = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).select({
      filterByFormula: `{UserID}='${esc(uid)}'`,
      maxRecords: 1,
    }).firstPage();

    if (existingRecords.length > 0) {
      const record = existingRecords[0];
      const fields = record.fields;
      
      // Extract preferences and order
      const preferences = {
        currentIndustry: fields.CurrentIndustry || "",
        currentRole: fields.CurrentRole || "",
        seniorityLevel: fields.SeniorityLevel || "",
        previousRoles: fields.PreviousRoles || "",
        mentoringStyle: fields.MentoringStyle || "",
        yearsExperience: fields.YearsExperience?.toString() || "",
        culturalBackground: fields.CultureBackground || "",
        availability: fields.Availability || ""
      };

      const order = fields.FactorOrder ? fields.FactorOrder.split(',').map((s: string) => s.trim()) : [];

      return NextResponse.json({
        success: true,
        preferences,
        order
      });
    } else {
      // No preferences found, return empty data
      return NextResponse.json({
        success: true,
        preferences: {},
        order: []
      });
    }
  } catch (err: any) {
    console.error("Error fetching mentee preferences:", err);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!ready) {
      return NextResponse.json(
        { error: "Backend not configured - missing Airtable credentials" },
        { status: 503 }
      );
    }

    const { uid, preferences, rankings, order } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json(
        { error: "Preferences data is required" },
        { status: 400 }
      );
    }

    if (!rankings || typeof rankings !== "object") {
      return NextResponse.json(
        { error: "Rankings data is required" },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = [
      "currentIndustry",
      "currentRole", 
      "seniorityLevel",
      "mentoringStyle",
      "yearsExperience",
      "availability"
    ];

    for (const field of requiredFields) {
      if (field === "yearsExperience") {
        // yearsExperience is a number field
        if (!preferences[field] || preferences[field] === "") {
          return NextResponse.json(
            { error: `${field} is required` },
            { status: 400 }
          );
        }
      } else {
        // Other fields are text fields
        if (!preferences[field]?.trim()) {
          return NextResponse.json(
            { error: `${field} is required` },
            { status: 400 }
          );
        }
      }
    }

    // Validate rankings
    for (const field of requiredFields) {
      if (!rankings[field] || rankings[field] === 0) {
        return NextResponse.json(
          { error: `Please rank ${field}` },
          { status: 400 }
        );
      }
    }

    // Check if preferences already exist for this user
    const existingRecords = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).select({
      filterByFormula: `{UserID}='${esc(uid)}'`,
      maxRecords: 1,
    }).firstPage();

    const preferenceData = {
      UserID: uid,
      CurrentIndustry: preferences.currentIndustry.trim(),
      CurrentRole: preferences.currentRole.trim(),
      SeniorityLevel: preferences.seniorityLevel.trim(),
      PreviousRoles: preferences.previousRoles?.trim() || "",
      MentoringStyle: preferences.mentoringStyle.trim(),
      YearsExperience: parseInt(preferences.yearsExperience) || 0,
      CultureBackground: preferences.culturalBackground?.trim() || "",
      Availability: preferences.availability.trim(),
      // Rankings (1-8, where 1 is most important)
      IndustryRank: rankings.currentIndustry,
      RoleRank: rankings.currentRole,
      SeniorityRank: rankings.seniorityLevel,
      PreviousRolesRank: rankings.previousRoles || 0,
      MentoringStyleRank: rankings.mentoringStyle,
      YearsExperienceRank: rankings.yearsExperience,
      CultureBackgroundRank: rankings.culturalBackground || 0,
      AvailabilityRank: rankings.availability,
      // Factor order (array of factor IDs in priority order)
      FactorOrder: order ? order.join(',') : "",
      UpdatedAt: nowISO(),
    };

    let result;
    if (existingRecords.length > 0) {
      // Update existing record
      const recordId = existingRecords[0].id;
      result = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).update(recordId, preferenceData);
      console.log("Updated mentee preferences for user:", uid);
    } else {
      // Create new record
      result = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).create([{ fields: preferenceData }]);
      console.log("Created mentee preferences for user:", uid);
    }

    console.log("Preferences:", preferences);
    console.log("Rankings:", rankings);
    console.log("Order:", order);

    // Trigger a match refresh to update mentor recommendations
    try {
      // This will be called by the frontend after successful save
      console.log("Preferences saved successfully. Next step: refresh matches.");
    } catch (error) {
      console.warn("Could not trigger match refresh:", error);
    }

    // Get user info to create JWT token
    let userEmail = "";
    let userRole = "mentee";
    
    try {
      const userResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/users?uid=${uid}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        userEmail = userData.email || "";
        userRole = userData.role || "mentee";
      }
    } catch (error) {
      console.warn("Could not fetch user info for JWT:", error);
    }

    // Create JWT token and set cookie
    let response;
    if (JWT_SECRET && userEmail) {
      const token = jwt.sign(
        { sub: userEmail.toLowerCase(), role: userRole, uid: uid, profile: true },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      response = NextResponse.json({ 
        success: true, 
        message: "Preferences saved successfully",
        recordId: result[0]?.id || existingRecords[0]?.id
      });

      response.cookies.set("session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    } else {
      response = NextResponse.json({ 
        success: true, 
        message: "Preferences saved successfully",
        recordId: result[0]?.id || existingRecords[0]?.id
      });
    }

    return response;

  } catch (error) {
    console.error("Error saving mentee preferences:", error);
    
    // Check if it's an Airtable field error
    if (error instanceof Error && error.message.includes('Unknown field name')) {
      return NextResponse.json(
        { error: "Database schema mismatch. Please check Airtable configuration." },
        { status: 422 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
