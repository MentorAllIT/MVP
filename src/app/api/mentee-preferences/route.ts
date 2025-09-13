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
      fields: [
        "CurrentIndustry", "CurrentRole", "SeniorityLevel", "PreviousRoles", 
        "RequiredMentoringStyles", "NicetohaveStyles", "YearsExperience", 
        "CultureBackground", "Availability", "CurrentCompany", "FactorOrder",
        "IndustryRank", "RoleRank", "SeniorityRank", "PreviousRolesRank", 
        "MentoringStyleRank", "YearsExperienceRank", "CultureBackgroundRank", 
        "AvailabilityRank", "CompanyRank"
      ]
    }).firstPage();

    if (existingRecords.length > 0) {
      const record = existingRecords[0];
      const fields = record.fields;
      
      // Extract preferences and order
      const dontMindOption = "I don't mind any mentoring style";
      
      // Check if mentoring style fields contain "I don't mind" option
      const hasRequiredStyles = Array.isArray(fields.RequiredMentoringStyles) && fields.RequiredMentoringStyles.length > 0;
      const hasNiceToHaveStyles = Array.isArray(fields.NicetohaveStyles) && fields.NicetohaveStyles.length > 0;
      
      // Check if either field contains "I don't mind any mentoring style"
      const requiredHasDontMind = hasRequiredStyles && fields.RequiredMentoringStyles.includes("I don't mind any mentoring style");
      const niceToHaveHasDontMind = hasNiceToHaveStyles && fields.NicetohaveStyles.includes("I don't mind any mentoring style");
      
      const isDontMind = requiredHasDontMind || niceToHaveHasDontMind;
      
      const preferences = {
        currentIndustry: fields.CurrentIndustry || "",
        currentRole: fields.CurrentRole || "",
        seniorityLevel: fields.SeniorityLevel || "",
        previousRoles: fields.PreviousRoles || "",
        mentoringStyle: isDontMind ? "dont_mind" : "",
        requiredMentoringStyles: isDontMind ? "dont_mind" : (Array.isArray(fields.RequiredMentoringStyles) ? 
          fields.RequiredMentoringStyles.join(', ') : 
          (fields.RequiredMentoringStyles || "")),
        niceToHaveStyles: isDontMind ? "dont_mind" : (Array.isArray(fields.NicetohaveStyles) ? 
          fields.NicetohaveStyles.join(', ') : 
          (fields.NicetohaveStyles || "")),
        yearsExperience: fields.YearsExperience?.toString() || "",
        culturalBackground: fields.CultureBackground || "",
        availability: fields.Availability || "",
        dreamCompanies: fields.CurrentCompany || ""
      };

      // Extract factor order and individual ranks
      const order = fields.FactorOrder ? fields.FactorOrder.split(',').map((s: string) => s.trim()) : [];
      
      // Extract individual rank fields
      const ranks = [
        { id: "currentIndustry", rank: fields.IndustryRank || 0 },
        { id: "currentRole", rank: fields.RoleRank || 0 },
        { id: "seniorityLevel", rank: fields.SeniorityRank || 0 },
        { id: "previousRoles", rank: fields.PreviousRolesRank || 0 },
        { id: "mentoringStyle", rank: fields.MentoringStyleRank || 0 },
        { id: "yearsExperience", rank: fields.YearsExperienceRank || 0 },
        { id: "culturalBackground", rank: fields.CultureBackgroundRank || 0 },
        { id: "availability", rank: fields.AvailabilityRank || 0 },
        { id: "dreamCompanies", rank: fields.CompanyRank || 0 }
      ].filter(item => item.rank > 0); // Only include factors that have been ranked

      return NextResponse.json({
        success: true,
        preferences,
        order,
        ranks
      });
    } else {
      // No preferences found, return empty data
      return NextResponse.json({
        success: true,
        preferences: {},
        order: [],
        ranks: []
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
    console.log("=== MENTEE PREFERENCES POST REQUEST ===");
    
    // Debug: Log environment variables status
    console.log("Environment check:", {
      AIRTABLE_API_KEY: !!AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID: !!AIRTABLE_BASE_ID,
      AIRTABLE_MENTEE_PREFERENCES_TABLE: !!AIRTABLE_MENTEE_PREFERENCES_TABLE,
      JWT_SECRET: !!JWT_SECRET,
      ready: ready
    });

    if (!ready) {
      console.error("Missing environment variables:", {
        AIRTABLE_API_KEY: !!AIRTABLE_API_KEY,
        AIRTABLE_BASE_ID: !!AIRTABLE_BASE_ID,
        AIRTABLE_MENTEE_PREFERENCES_TABLE: !!AIRTABLE_MENTEE_PREFERENCES_TABLE
      });
      return NextResponse.json(
        { error: "Backend not configured - missing Airtable credentials" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    
    const uid = formData.get('uid') as string;
    const role = formData.get('role') as string;

    if (!uid) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Extract preferences from FormData
    const preferences: { [key: string]: string } = {
      currentIndustry: formData.get('currentIndustry') as string || "",
      currentRole: formData.get('currentRole') as string || "",
      seniorityLevel: formData.get('seniorityLevel') as string || "",
      previousRoles: formData.get('previousRoles') as string || "",
      mentoringStyle: formData.get('mentoringStyle') as string || "",
      requiredMentoringStyles: formData.get('requiredMentoringStyles') as string || "",
      niceToHaveStyles: formData.get('niceToHaveStyles') as string || "",
      yearsExperience: formData.get('yearsExperience') as string || "",
      culturalBackground: formData.get('culturalBackground') as string || "",
      availability: formData.get('availability') as string || "",
      dreamCompanies: formData.get('dreamCompanies') as string || "",
      factorOrder: formData.get('factorOrder') as string || "",
      factorRanks: formData.get('factorRanks') as string || ""
    };

    // Check if this is a step 2 request (only factor order and ranks)
    const isStep2Request = preferences.factorOrder && preferences.factorRanks && 
                          !preferences.currentIndustry && !preferences.currentRole;

    // Only validate required fields if this is not a step 2 request
    if (!isStep2Request) {
      const requiredFields = [
        "currentIndustry",
        "currentRole", 
        "seniorityLevel",
        "mentoringStyle",
        "yearsExperience",
        "availability",
        "dreamCompanies"
      ];

      for (const field of requiredFields) {
        if (field === "yearsExperience") {
          // yearsExperience is a number field
          if (!preferences[field] || preferences[field] === "" || preferences[field] === "0") {
            return NextResponse.json(
              { error: `${field} is required and must be greater than 0` },
              { status: 400 }
            );
          }
          // Additional validation for years experience
          const yearsValue = parseInt(preferences[field]);
          if (isNaN(yearsValue) || yearsValue <= 0) {
            return NextResponse.json(
              { error: `${field} must be a valid number greater than 0` },
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
    }

    // Normalize mentoring style labels to match Airtable Multiple select options
    const normalizeMentoringStyle = (style: string) => {
      const labelMap: { [key: string]: string } = {
        'coaching': 'Coaching',
        'roleModelling': 'Role Modelling', 
        'rolemodelling': 'Role Modelling',
        'technical': 'Technical',
        'holistic': 'Holistic',
        'facilitative': 'Facilitative',
        'none': 'None'
      };
      
      // Clean the input (remove quotes and extra spaces)
      const cleanStyle = style.replace(/"/g, '').trim();
      const normalized = labelMap[cleanStyle.toLowerCase()] || cleanStyle;
      
      return normalized;
    };

    // Check if preferences already exist for this user
    let existingRecords;
    try {
      existingRecords = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).select({
        filterByFormula: `{UserID}='${esc(uid)}'`,
        maxRecords: 1,
      }).firstPage();
    } catch (airtableError) {
      throw airtableError;
    }

    // Process mentoring style for storage (Only using RequiredMentoringStyles and NicetohaveStyles)
    
    let requiredMentoringStylesForStorage: string[] | null = null;
    let niceToHaveStylesForStorage: string[] | null = null;
    
    if (preferences.mentoringStyle === 'dont_mind') {
      // When "I don't mind" is selected, set both fields to the "I don't mind" option
      requiredMentoringStylesForStorage = ["I don't mind any mentoring style"]; // Set RequiredMentoringStyles
      niceToHaveStylesForStorage = ["I don't mind any mentoring style"]; // Set NicetohaveStyles
    } else if (preferences.requiredMentoringStyles && preferences.requiredMentoringStyles.trim()) {
      // Store all required styles in RequiredMentoringStyles field
      const normalizedRequiredStyles = preferences.requiredMentoringStyles
        .split(',')
        .map(s => normalizeMentoringStyle(s.trim()));
      requiredMentoringStylesForStorage = normalizedRequiredStyles; // Store all required styles
    } else {
    }
    


    let preferenceData: any;

    if (isStep2Request) {
      // Step 2: Only update factor order and individual rank fields
      const factorRanks = preferences.factorRanks ? JSON.parse(preferences.factorRanks) : [];
      
      preferenceData = {
        FactorOrder: preferences.factorOrder || "",
        UpdatedAt: nowISO(),
      };
      
      // Map factor ranks to individual Airtable fields
      factorRanks.forEach((item: { id: string; rank: number }) => {
        switch (item.id) {
          case "currentIndustry":
            preferenceData.IndustryRank = item.rank;
            break;
          case "currentRole":
            preferenceData.RoleRank = item.rank;
            break;
          case "seniorityLevel":
            preferenceData.SeniorityRank = item.rank;
            break;
          case "previousRoles":
            preferenceData.PreviousRolesRank = item.rank;
            break;
          case "mentoringStyle":
            preferenceData.MentoringStyleRank = item.rank;
            break;
          case "yearsExperience":
            preferenceData.YearsExperienceRank = item.rank;
            break;
          case "culturalBackground":
            preferenceData.CultureBackgroundRank = item.rank;
            break;
          case "availability":
            preferenceData.AvailabilityRank = item.rank;
            break;
          case "dreamCompanies":
            preferenceData.CompanyRank = item.rank;
            break;
        }
      });
    } else {
      // Step 1: Update all preference fields
      preferenceData = {
        UserID: uid,
        CurrentIndustry: preferences.currentIndustry.trim(),
        CurrentRole: preferences.currentRole.trim(),
        SeniorityLevel: preferences.seniorityLevel.trim(),
        PreviousRoles: preferences.previousRoles?.trim() || "",
        YearsExperience: parseInt(preferences.yearsExperience) || 0,
        CultureBackground: preferences.culturalBackground?.trim() || "",
        Availability: preferences.availability.trim(),
        CurrentCompany: preferences.dreamCompanies?.trim() || "",
        // Factor order (array of factor IDs in priority order)
        FactorOrder: preferences.factorOrder || "",
        UpdatedAt: nowISO(),
      };
    }


    // Note: MentoringStyle field removed - only using RequiredMentoringStyles for mentees
    // if (mentoringStyleForStorage !== null) {
    //   preferenceData.MentoringStyle = mentoringStyleForStorage;
    // }

    // Handle mentoring style arrays - only for step 1
    if (!isStep2Request) {
      if (requiredMentoringStylesForStorage !== null) {
        preferenceData.RequiredMentoringStyles = requiredMentoringStylesForStorage;
      } else if (preferences.requiredMentoringStyles && preferences.requiredMentoringStyles.trim()) {
        const normalizedStyles = preferences.requiredMentoringStyles
          .split(',')
          .map(s => normalizeMentoringStyle(s.trim()))
          .filter(s => s); // Remove empty strings
        
        preferenceData.RequiredMentoringStyles = normalizedStyles;
      }

      if (niceToHaveStylesForStorage !== null) {
        preferenceData.NicetohaveStyles = niceToHaveStylesForStorage;
      } else if (preferences.niceToHaveStyles && preferences.niceToHaveStyles.trim()) {
        const normalizedNiceToHave = preferences.niceToHaveStyles
          .split(',')
          .map(s => normalizeMentoringStyle(s.trim()))
          .filter(s => s); // Remove empty strings
        
        // If "None" is selected, save it as "None" in Airtable
        if (normalizedNiceToHave.includes('None')) {
          preferenceData.NicetohaveStyles = ['None'];
        } else {
          preferenceData.NicetohaveStyles = normalizedNiceToHave;
        }
      }
    }
    

    let result;
    try {
      if (existingRecords.length > 0) {
        // Update existing record
        const recordId = existingRecords[0].id;
        result = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).update(recordId, preferenceData);
      } else {
        // Create new record
        result = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).create([{ fields: preferenceData }]);
      }
    } catch (airtableWriteError) {
      throw airtableWriteError;
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
      // Could not fetch user info for JWT
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
      console.error("Airtable field error:", error.message);
      return NextResponse.json(
        { error: `Database schema mismatch: ${error.message}. Please check Airtable configuration.` },
        { status: 422 }
      );
    }
    
    // Check if it's an Airtable validation error
    if (error instanceof Error && error.message.includes('INVALID_MULTIPLE_CHOICE_OPTIONS')) {
      console.error("Airtable validation error:", error.message);
      return NextResponse.json(
        { error: `Invalid field values: ${error.message}. Please check your selections.` },
        { status: 422 }
      );
    }
    
    // Check if it's a JSON parsing error
    if (error instanceof Error && error.message.includes('Unexpected end of JSON input')) {
      console.error("JSON parsing error:", error.message);
      return NextResponse.json(
        { error: `Data processing error: ${error.message}. Please try again.` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}