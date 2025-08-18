import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_MENTEE_META_TABLE,
  AIRTABLE_MENTOR_META_TABLE,
  AIRTABLE_MATCH_RANKING_TABLE,
  AIRTABLE_MENTEE_PREFERENCES_TABLE,
  JWT_SECRET,
} = process.env;

const ready =
  AIRTABLE_API_KEY &&
  AIRTABLE_BASE_ID &&
  AIRTABLE_MENTEE_META_TABLE &&
  AIRTABLE_MENTOR_META_TABLE &&
  AIRTABLE_MATCH_RANKING_TABLE &&
  AIRTABLE_MENTEE_PREFERENCES_TABLE &&
  JWT_SECRET;

let base: any = null;
if (ready) base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);

const esc = (s: string) => String(s).replace(/'/g, "\\'");
const nowISO = () => new Date().toISOString();

// Utilities
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e: any) {
      last = e;
      const transient = e?.code === "ETIMEDOUT" || e?.status === 429 || e?.statusCode === 429;
      if (transient && i < tries - 1) { await sleep(300 * (i + 1)); continue; }
      console.error(`${label} failed:`, e?.message || e);
      throw e;
    }
  }
  throw last;
}
async function firstPage(table: string, opts: any): Promise<any[]> {
  return withRetry<any[]>(`Select ${table}`, () => base(table).select(opts).firstPage());
}
async function batchCreate(table: string, records: any[]) {
  const CHUNK = 10;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    await withRetry(`Create ${table}`, () => base(table).create(slice));
  }
}
async function batchUpdate(table: string, records: any[]) {
  const CHUNK = 10;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    // @ts-ignore
    await withRetry(`Update ${table}`, () => base(table).update(slice));
  }
}

// Tags are no longer used - algorithm is purely preference-based

// Clean preference-based scoring function (100% preference-based)
function calculatePreferenceScore(
  menteePrefs: any,
  mentorMeta: any
): { score: number; preferenceScore: number; breakdown: string } {
  
  try {
    console.log("🔍 calculatePreferenceScore called with:", { menteePrefs, mentorMeta });
    
    // Pure preference-based scoring with priority-based weighting
    let preferenceScore = 0;

    if (menteePrefs && mentorMeta) {
    // Get the factor order to determine priorities
    const factorOrder = menteePrefs.FactorOrder ? menteePrefs.FactorOrder.split(',') : [];
    
    // Calculate scores for each factor
    const factorScores: { [key: string]: number } = {};
    
    // Industry match
    if (menteePrefs.CurrentIndustry && mentorMeta.Industry) {
      const industryMatch = menteePrefs.CurrentIndustry.toLowerCase() === mentorMeta.Industry.toLowerCase() ? 1 : 0;
      factorScores['currentIndustry'] = industryMatch;
    }

    // Role match
    if (menteePrefs.CurrentRole && mentorMeta.Role) {
      const roleMatch = menteePrefs.CurrentRole.toLowerCase() === mentorMeta.Role.toLowerCase() ? 1 : 0;
      factorScores['currentRole'] = roleMatch;
    }

    // Seniority match
    if (menteePrefs.SeniorityLevel && mentorMeta.Role) {
      const seniorityMatch = calculateSeniorityMatch(menteePrefs.SeniorityLevel, mentorMeta.Role);
      factorScores['seniorityLevel'] = seniorityMatch;
    }

    // Years of experience match
    if (menteePrefs.YearsExperience && mentorMeta.YearExp) {
      const expMatch = calculateExperienceMatch(menteePrefs.YearsExperience, mentorMeta.YearExp);
      factorScores['yearsExperience'] = expMatch;
    }

    // Mentoring style match
    if (menteePrefs.MentoringStyle && mentorMeta.Role) {
      const styleMatch = calculateMentoringStyleMatch(menteePrefs.MentoringStyle, mentorMeta.Role);
      factorScores['mentoringStyle'] = styleMatch;
    }

    // Previous roles match (if available)
    if (menteePrefs.PreviousRoles && mentorMeta.Role) {
      const previousRolesMatch = calculatePreviousRolesMatch(menteePrefs.PreviousRoles, mentorMeta.Role);
      factorScores['previousRoles'] = previousRolesMatch;
    }

    // Cultural background match (if available)
    if (menteePrefs.CultureBackground && mentorMeta.Role) {
      const culturalMatch = calculateCulturalMatch(menteePrefs.CultureBackground, mentorMeta.Role);
      factorScores['culturalBackground'] = culturalMatch;
    }

    // Availability match (if available)
    if (menteePrefs.Availability && mentorMeta.Role) {
      const availabilityMatch = calculateAvailabilityMatch(menteePrefs.Availability, mentorMeta.Role);
      factorScores['availability'] = availabilityMatch;
    }

    // Apply priority-based weighting
    if (factorOrder.length > 0) {
      // Top priority (35% weight)
      if (factorOrder[0] && factorScores[factorOrder[0]] !== undefined) {
        preferenceScore += factorScores[factorOrder[0]] * 0.35;
      }

      // Second priority (25% weight)
      if (factorOrder[1] && factorScores[factorOrder[1]] !== undefined) {
        preferenceScore += factorScores[factorOrder[1]] * 0.25;
      }

      // Third priority (10% weight)
      if (factorOrder[2] && factorScores[factorOrder[2]] !== undefined) {
        preferenceScore += factorScores[factorOrder[2]] * 0.10;
      }

      // Remaining factors (30% weight distributed equally)
      const remainingFactors = factorOrder.slice(3).filter((factor: string) => factorScores[factor] !== undefined);
      if (remainingFactors.length > 0) {
        const remainingWeight = 0.30 / remainingFactors.length;
        for (const factor of remainingFactors) {
          preferenceScore += factorScores[factor] * remainingWeight;
        }
      }
    } else {
      // Fallback: equal weighting if no factor order
      const availableFactors = Object.values(factorScores);
      if (availableFactors.length > 0) {
        preferenceScore = availableFactors.reduce((sum, score) => sum + score, 0) / availableFactors.length;
      }
    }
  }

  // Final score is 100% preference-based
  const finalScore = preferenceScore;
  
  return {
    score: Math.round(100 * finalScore),
    preferenceScore: Math.round(100 * preferenceScore),
    breakdown: `Preference Score: ${Math.round(100 * preferenceScore)}%`
  };
  } catch (error) {
    console.log("❌ Error in calculatePreferenceScore:", error);
    return {
      score: 0,
      preferenceScore: 0,
      breakdown: `Error: ${error}`
    };
  }
}

// Helper function to calculate seniority match
function calculateSeniorityMatch(menteeSeniority: string, mentorRole: string): number {
  const seniorityLevels = {
    'Junior': 1,
    'Mid-level': 2,
    'Senior': 3,
    'Manager': 4,
    'Director': 5,
    'Executive': 6
  };

  const menteeLevel = seniorityLevels[menteeSeniority as keyof typeof seniorityLevels] || 1;
  const mentorLevel = seniorityLevels[mentorRole as keyof typeof seniorityLevels] || 1;
  
  // Prefer mentors at or above mentee's level, with bonus for close matches
  if (mentorLevel >= menteeLevel) {
    const levelDiff = mentorLevel - menteeLevel;
    if (levelDiff === 0) return 1.0;        // Exact match
    if (levelDiff === 1) return 0.9;        // One level above
    if (levelDiff === 2) return 0.8;        // Two levels above
    return 0.7;                             // Much higher level
  } else {
    return 0.3;                             // Lower level (still valuable but less ideal)
  }
}

// Helper function to calculate experience match
function calculateExperienceMatch(menteeYears: number, mentorYears: number): number {
  const diff = Math.abs(mentorYears - menteeYears);
  if (diff === 0) return 1.0;           // Exact match
  if (diff <= 2) return 0.9;            // Within 2 years
  if (diff <= 5) return 0.8;            // Within 5 years
  if (diff <= 10) return 0.7;           // Within 10 years
  return 0.5;                            // Much different experience
}

// Helper function to calculate mentoring style match (simplified)
function calculateMentoringStyleMatch(menteeStyle: string, mentorRole: string): number {
  // Simple matching based on role keywords
  const mentorRoleLower = mentorRole.toLowerCase();
  
  if (menteeStyle === 'Direct' && (mentorRoleLower.includes('manager') || mentorRoleLower.includes('director'))) {
    return 0.8; // Managers/directors tend to be more direct
  } else if (menteeStyle === 'Supportive' && (mentorRoleLower.includes('coach') || mentorRoleLower.includes('mentor'))) {
    return 0.8; // Coaches tend to be more supportive
  } else if (menteeStyle === 'Analytical' && (mentorRoleLower.includes('analyst') || mentorRoleLower.includes('scientist'))) {
    return 0.8; // Analysts/scientists tend to be more analytical
  }
  
  return 0.5; // Default neutral score
}

// Helper function to calculate previous roles match
function calculatePreviousRolesMatch(menteePreviousRoles: string, mentorRole: string): number {
  if (!menteePreviousRoles || !mentorRole) return 0;
  
  const menteeRoles = menteePreviousRoles.toLowerCase().split(/[,;]+/).map(r => r.trim());
  const mentorRoleLower = mentorRole.toLowerCase();
  
  // Check if mentor's current role matches any of the mentee's desired previous roles
  for (const desiredRole of menteeRoles) {
    if (mentorRoleLower.includes(desiredRole) || desiredRole.includes(mentorRoleLower)) {
      return 1.0; // Perfect match
    }
  }
  
  return 0.0; // No match
}

// Helper function to calculate cultural background match (simplified)
function calculateCulturalMatch(menteeCultural: string, mentorRole: string): number {
  if (!menteeCultural || !mentorRole) return 0;
  
  const menteeCulturalLower = menteeCultural.toLowerCase();
  const mentorRoleLower = mentorRole.toLowerCase();
  
  // Simple matching based on role and cultural keywords
  if (menteeCulturalLower.includes('international') && mentorRoleLower.includes('global')) {
    return 0.8; // International mentee with global role
  } else if (menteeCulturalLower.includes('bilingual') && mentorRoleLower.includes('international')) {
    return 0.7; // Bilingual mentee with international role
  }
  
  return 0.5; // Default neutral score
}

// Helper function to calculate availability match
function calculateAvailabilityMatch(menteeAvailability: string, mentorTags: string[]): number {
  if (!menteeAvailability || !mentorTags.length) return 0;
  
  const menteeAvailabilityLower = menteeAvailability.toLowerCase();
  const mentorTagSet = new Set(mentorTags.map(t => t.toLowerCase()));
  
  // Look for availability keywords in mentor tags
  const availabilityKeywords = ['flexible', 'weekly', 'bi-weekly', 'monthly', 'weekend', 'evening'];
  let matchCount = 0;
  
  for (const keyword of availabilityKeywords) {
    if (menteeAvailabilityLower.includes(keyword) || mentorTagSet.has(keyword)) {
      matchCount++;
    }
  }
  
  return matchCount / availabilityKeywords.length;
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Refresh match started");
    
    if (!ready) {
      console.log("❌ Environment not ready");
      return NextResponse.json({ error: "Airtable not configured" }, { status: 503 });
    }

    const token = request.cookies.get("session")?.value;
    if (!token) {
      console.log("❌ No token found");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let uid: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as any;
      uid = decoded.uid;
      console.log("✅ Token verified, UID:", uid);
    } catch (err) {
      console.log("❌ Token verification failed");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if user is a mentee
    const [userRec] = await firstPage("Users", {
      filterByFormula: `{UserID}='${esc(uid)}'`,
      maxRecords: 1,
      fields: ["Role"],
    });
    
    if (!userRec || userRec.fields?.Role !== "mentee") {
      console.log("❌ User is not a mentee");
      return NextResponse.json({ message: "Only mentees refresh matches" }, { status: 200 });
    }

    console.log("🔍 Loading mentee data...");
    // Load mentee data (preferences only)
    const [menteeRec] = await firstPage(AIRTABLE_MENTEE_META_TABLE!, {
      filterByFormula: `{UserID}='${esc(uid)}'`,
      maxRecords: 1,
      fields: ["UserID", "LastPaired"],
    });
    if (!menteeRec) {
      console.log("❌ MenteeMeta not found");
      return NextResponse.json({ error: "MenteeMeta not found" }, { status: 404 });
    }

    console.log("🔍 Loading mentee preferences...");
    // Load mentee preferences
    const [prefRec] = await firstPage(AIRTABLE_MENTEE_PREFERENCES_TABLE!, {
      filterByFormula: `{UserID}='${esc(uid)}'`,
      maxRecords: 1,
      fields: ["CurrentIndustry", "CurrentRole", "SeniorityLevel", "PreviousRoles", "MentoringStyle", "YearsExperience", "CultureBackground", "Availability", "IndustryRank", "RoleRank", "SeniorityRank", "PreviousRolesRank", "MentoringStyleRank", "YearsExperienceRank", "CultureBackgroundRank", "AvailabilityRank", "FactorOrder"],
    });

    if (!prefRec) {
      console.log("❌ No mentee preferences found");
      return NextResponse.json({ updated: 0, created: 0, total: 0, info: "No mentee preferences found" });
    }

    console.log("🔍 Loading mentors...");
    const lastPairedISO: string | null = menteeRec.fields?.LastPaired || null;

    // Load mentors (only those updated after mentee last paired)
    let mentorFilter = "";
    if (lastPairedISO) {
      mentorFilter = `IS_AFTER({UpdatedAt}, DATETIME_PARSE('${esc(lastPairedISO)}'))`;
    }
    let mentorRows = await firstPage(AIRTABLE_MENTOR_META_TABLE!, {
      ...(mentorFilter ? { filterByFormula: mentorFilter } : {}),
      fields: ["UserID", "UpdatedAt", "Industry", "Role", "YearExp"],
    });
    // Fallback if no mentee last paired
    if (!lastPairedISO && mentorRows.length === 0) {
      console.log("🔍 No mentors found with filter, trying fallback...");
      mentorRows = await firstPage(AIRTABLE_MENTOR_META_TABLE!, {
        fields: ["UserID", "UpdatedAt", "Industry", "Role", "YearExp"],
      });
    }

    console.log(`✅ Found ${mentorRows.length} mentors`);

    // Compute enhanced scores
    type ScoreRow = { 
      mentorId: string; 
      score: number; 
      overlap: number; 
      preferenceScore: number; 
      tagScore: number;
      breakdown: string;
    };
    const scores: ScoreRow[] = [];

    console.log("🔍 Calculating scores...");
    for (const r of mentorRows) {
      try {
        const mentorId = r.fields?.UserID as string | undefined;
        if (!mentorId) {
          console.log("⚠️ Skipping mentor with no UserID");
          continue;
        }

        const mentorMeta = {
          Industry: r.fields?.Industry,
          Role: r.fields?.Role,
          YearExp: r.fields?.YearExp
        };

        console.log(`🔍 Processing mentor ${mentorId}:`, mentorMeta);

        const result = calculatePreferenceScore(
          prefRec?.fields, 
          mentorMeta
        );

        console.log(`✅ Mentor ${mentorId} score:`, result);

        if (result.score > 0) {
          scores.push({ 
            mentorId, 
            score: result.score, 
            overlap: 0, // No more tag overlap
            preferenceScore: result.preferenceScore,
            tagScore: 0, // No more tag score
            breakdown: result.breakdown
          });
        }
      } catch (error) {
        console.log(`❌ Error processing mentor ${r.fields?.UserID}:`, error);
        continue; // Skip this mentor and continue with others
      }
    }

    console.log(`✅ Calculated ${scores.length} scores`);

    // If nobody matches, still bump mentee last paired so next run can be incremental
    if (!scores.length) {
      console.log("❌ No matching mentors found");
      await withRetry("Update LastPaired", () =>
        base(AIRTABLE_MENTEE_META_TABLE!).update(menteeRec.id, { LastPaired: nowISO() })
      );
      return NextResponse.json({ updated: 0, created: 0, total: 0, info: "No matching mentors found" });
    }

    console.log("🔍 Updating MatchRanking...");
    // Update MatchRanking for this mentee
    const existing = await firstPage(AIRTABLE_MATCH_RANKING_TABLE!, {
      filterByFormula: `{MenteeID}='${esc(uid)}'`,
      fields: ["MentorID"],
    });
    const existingMap = new Map<string, string>();
    for (const r of existing) {
      const mid = r.fields?.MentorID;
      if (mid) existingMap.set(String(mid), r.id);
    }

    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const ts = nowISO();

    for (const { mentorId, score, preferenceScore, tagScore, breakdown } of scores) {
      const recId = existingMap.get(mentorId);
      if (recId) {
        toUpdate.push({ 
          id: recId, 
          fields: { 
            Score: score,
            PreferenceScore: preferenceScore,
            TagScore: tagScore,
            Breakdown: breakdown
            // UpdatedAt is computed by Airtable
          } 
        });
      } else {
        toCreate.push({ 
          fields: { 
            MenteeID: uid, 
            MentorID: mentorId, 
            Score: score,
            PreferenceScore: preferenceScore,
            TagScore: tagScore,
            Breakdown: breakdown
            // CreatedAt and UpdatedAt are computed by Airtable
          } 
        });
      }
    }

    console.log(`🔍 Creating ${toCreate.length} new records, updating ${toUpdate.length} existing records`);

    try {
      if (toCreate.length) await batchCreate(AIRTABLE_MATCH_RANKING_TABLE!, toCreate);
      if (toUpdate.length) await batchUpdate(AIRTABLE_MATCH_RANKING_TABLE!, toUpdate);
    } catch (err: any) {
      console.log("❌ Error updating MatchRanking:", err);
      const msg = String(err?.message || err || "");
      if (msg.includes('Unknown field name')) {
        return NextResponse.json(
          { error: `Operation failed: ${msg}` },
          { status: 422 }
        );
      }
      throw err;
    }

    // Update LastPaired so next run only checks recent mentors
    await withRetry("Update LastPaired", () =>
      base(AIRTABLE_MENTEE_META_TABLE!).update(menteeRec.id, { LastPaired: ts })
    );

    scores.sort((a, b) => b.score - a.score);
    console.log("✅ Preference-based matching scores:", scores);
    return NextResponse.json({
      total: scores.length,
      created: toCreate.length,
      updated: toUpdate.length,
      top: scores.slice(0, 10), // preview with preference data
    });
  } catch (e: any) {
    const status = e?.statusCode || e?.status || 500;
    return NextResponse.json({ error: e?.message || "Server error" }, { status });
  }
}
