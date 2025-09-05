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
    console.log("=== MENTEE PREFERENCES POST REQUEST ===");

    if (!ready) {
      return NextResponse.json(
        { error: "Backend not configured - missing Airtable credentials" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const uid = formData.get('uid') as string;

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
      factorOrder: formData.get('factorOrder') as string || ""
    };

    // Basic validation
    if (!preferences.yearsExperience || preferences.yearsExperience === "0") {
      return NextResponse.json(
        { error: "Years of experience is required and must be greater than 0" },
        { status: 400 }
      );
    }

    const yearsValue = parseInt(preferences.yearsExperience);
    if (isNaN(yearsValue) || yearsValue <= 0) {
      return NextResponse.json(
        { error: "Years of experience must be a valid number greater than 0" },
        { status: 400 }
      );
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
      return labelMap[cleanStyle.toLowerCase()] || cleanStyle;
    };

    // Check if preferences already exist for this user
    const existingRecords = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).select({
      filterByFormula: `{UserID}='${esc(uid)}'`,
      maxRecords: 1,
    }).firstPage();

    // Process mentoring style for storage (Single select field - only one value allowed)
    
    let mentoringStyleForStorage: string | null = null;
    let requiredMentoringStylesForStorage: string[] | null = null;
    let niceToHaveStylesForStorage: string[] | null = null;
    
    if (preferences.mentoringStyle === 'dont_mind') {
      // When "I don't mind" is selected, set both fields to the "I don't mind" option
      mentoringStyleForStorage = null; // Skip MentoringStyle field entirely
      requiredMentoringStylesForStorage = ["I don't mind any mentoring style"]; // Set RequiredMentoringStyles
      niceToHaveStylesForStorage = ["I don't mind any mentoring style"]; // Set NicetohaveStyles
    } else if (preferences.requiredMentoringStyles && preferences.requiredMentoringStyles.trim()) {
      // Store only the first required style for the MentoringStyle Single select field
      const normalizedRequiredStyles = preferences.requiredMentoringStyles
        .split(',')
        .map(s => normalizeMentoringStyle(s.trim()));
      mentoringStyleForStorage = normalizedRequiredStyles[0] || 'Coaching'; // Take first one only
      requiredMentoringStylesForStorage = normalizedRequiredStyles; // Store all required styles
    } else {
    }
    

    // Debug: Show the normalization process
    if (preferences.requiredMentoringStyles) {
      const styles = preferences.requiredMentoringStyles.split(',').map(s => s.trim());
      const normalized = styles.map(s => normalizeMentoringStyle(s));
    }
    
    if (preferences.niceToHaveStyles) {
      const styles = preferences.niceToHaveStyles.split(',').map(s => s.trim());
      const normalized = styles.map(s => normalizeMentoringStyle(s));
    }

    const preferenceData: any = {
      UserID: uid,
      CurrentIndustry: preferences.currentIndustry.trim(),
      CurrentRole: preferences.currentRole.trim(),
      SeniorityLevel: preferences.seniorityLevel.trim(),
      PreviousRoles: preferences.previousRoles?.trim() || "",
      YearsExperience: parseInt(preferences.yearsExperience) || 0,
      CultureBackground: preferences.culturalBackground?.trim() || "",
      Availability: preferences.availability.trim(),
      // Factor order (array of factor IDs in priority order)
      FactorOrder: preferences.factorOrder || "",
      UpdatedAt: nowISO(),
    };

    // Only include MentoringStyle if it's not null
    if (mentoringStyleForStorage !== null) {
      preferenceData.MentoringStyle = mentoringStyleForStorage;
    }

    // Handle mentoring style arrays - include empty arrays to clear fields
    if (requiredMentoringStylesForStorage !== null) {
      preferenceData.RequiredMentoringStyles = requiredMentoringStylesForStorage;
    } else if (preferences.requiredMentoringStyles && preferences.requiredMentoringStyles.trim()) {
      preferenceData.RequiredMentoringStyles = preferences.requiredMentoringStyles
        .split(',')
        .map(s => normalizeMentoringStyle(s.trim()))
        .filter(s => s); // Remove empty strings
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
    

    let result;
    if (existingRecords.length > 0) {
      // Update existing record
      const recordId = existingRecords[0].id;
      result = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).update(recordId, preferenceData);
    } else {
      // Create new record
      result = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).create([{ fields: preferenceData }]);
    }
    
    // Debug: Show the normalization process
    if (preferences.requiredMentoringStyles) {
      const styles = preferences.requiredMentoringStyles.split(',').map(s => s.trim());
      const normalized = styles.map(s => normalizeMentoringStyle(s));
    }

    // Return success response
    return NextResponse.json({ 
      success: true, 
      message: "Preferences saved successfully",
      recordId: result[0]?.id || existingRecords[0]?.id
    });

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