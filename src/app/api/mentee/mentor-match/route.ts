import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_USERS_TABLE,
  AIRTABLE_PROFILES_TABLE,
  AIRTABLE_MENTOR_META_TABLE,
  AIRTABLE_MENTEE_PREFERENCES_TABLE,
  AIRTABLE_MENTEE_META_TABLE,
  JWT_SECRET,
} = process.env;

const ready =
  AIRTABLE_API_KEY &&
  AIRTABLE_BASE_ID &&
  AIRTABLE_USERS_TABLE &&
  AIRTABLE_PROFILES_TABLE &&
  AIRTABLE_MENTOR_META_TABLE &&
  AIRTABLE_MENTEE_PREFERENCES_TABLE &&
  AIRTABLE_MENTEE_META_TABLE &&
  JWT_SECRET;

let base: any = null;
if (ready) base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);

const esc = (s: string) => String(s).replace(/'/g, "\\'");
const clean = (v: any) =>
  typeof v === "string"
    ? v
        .replace(/\s+/g, " ")
        .replace(/(\s*,\s*)+,/g, ", ")
        .replace(/,\s*$/, "")
        .trim()
    : v;

// Retry helper
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      last = e;
      const transient = e?.code === "ETIMEDOUT" || e?.status === 429 || e?.statusCode === 429;
      if (transient && i < tries - 1) {
        await sleep(300 * (i + 1));
        continue;
      }
      console.error(`${label} failed:`, e?.message || e);
      throw e;
    }
  }
  throw last;
}

async function firstPage(table: string, options: any): Promise<any[]> {
  return withRetry<any[]>(`Select ${table}`, () => base(table).select(options).firstPage());
}

async function fetchByUserIds(table: string, ids: string[], fields?: string[]): Promise<any[]> {
  if (!ids.length) return [];
  const CHUNK = 10;
  const all: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const filter = `OR(${slice.map((id) => `{UserID}='${esc(id)}'`).join(",")})`;
    const rows: any[] = await firstPage(table, { filterByFormula: filter, fields });
    all.push(...rows);
  }
  return all;
}

// Convert tags to array of strings
function normalizeTags(raw: any): string[] {
  if (!raw) return [];
  const flat = (Array.isArray(raw) ? raw : [raw]).flat(5);
  const labels = flat.flatMap((t: any) => {
    let val = "";
    
    // Handle Airtable-generated tag objects
    if (typeof t === "object" && t !== null) {
      if (t.value) {
        val = t.value; // Extract the actual tag value
      } else if (t.name) {
        val = t.name;
      } else if (t.label) {
        val = t.label;
      } else if (t.title) {
        val = t.title;
      } else if (t.text) {
        val = t.text;
      }
    } else if (typeof t === "string") {
      val = t;
    }
    
    if (!val) return [];
    
    // Split comma/semicolon separated values and clean them
    return String(val)
      .split(/[,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  });
  
  // Dedupe and limit
  return Array.from(new Set(labels)).slice(0, 30);
}

// Real-time preference scoring function (FULL ALGORITHM - same as refresh-match)
function calculatePreferenceScore(
  menteePrefs: any,
  mentorMeta: any
): { score: number; preferenceScore: number; breakdown: string } {
  
  // CRITICAL DEBUG: Always show when this function is called
  console.log(`\n🚀🚀🚀 calculatePreferenceScore CALLED 🚀🚀🚀`);
  console.log(`🚀 menteePrefs:`, JSON.stringify(menteePrefs, null, 2));
  console.log(`🚀 mentorMeta:`, JSON.stringify(mentorMeta, null, 2));
  
  try {
    console.log("🔍 Real-time scoring for:", { menteePrefs, mentorMeta });
    
    // Pure preference-based scoring with priority-based weighting
    let preferenceScore = 0;

    if (menteePrefs && mentorMeta) {
      // Get the factor order to determine priorities
      const factorOrder = menteePrefs.FactorOrder ? menteePrefs.FactorOrder.split(',') : [];
      
      // Calculate scores for each factor
      const factorScores: { [key: string]: number } = {};
      
      // Industry match
      if (menteePrefs.CurrentIndustry && mentorMeta.Industry) {
        const industryMatch = calculateIndustryMatch(menteePrefs.CurrentIndustry, mentorMeta.Industry);
        factorScores['currentIndustry'] = industryMatch;
        console.log(`🏭 Industry match: "${menteePrefs.CurrentIndustry}" vs "${mentorMeta.Industry}" = ${industryMatch}`);
      }

      // Role match - FIXED: compare with CurrentRole field
      if (menteePrefs.CurrentRole && mentorMeta.CurrentRole) {
        const roleMatch = calculateRoleMatch(menteePrefs.CurrentRole, mentorMeta.CurrentRole);
        factorScores['currentRole'] = roleMatch;
        console.log(`👔 Role match: "${menteePrefs.CurrentRole}" vs "${mentorMeta.CurrentRole}" = ${roleMatch}`);
      }

      // Seniority match - FIXED: compare with SeniorityLevel field
      if (menteePrefs.SeniorityLevel && mentorMeta.SeniorityLevel) {
        const seniorityMatch = calculateSeniorityMatch(menteePrefs.SeniorityLevel, mentorMeta.SeniorityLevel);
        factorScores['seniorityLevel'] = seniorityMatch;
        console.log(`📊 Seniority match: "${menteePrefs.SeniorityLevel}" vs "${mentorMeta.SeniorityLevel}" = ${seniorityMatch}`);
      }

      // Years of experience match
      if (menteePrefs.YearsExperience && mentorMeta.YearExp) {
        const expMatch = calculateExperienceMatch(menteePrefs.YearsExperience, mentorMeta.YearExp);
        factorScores['yearsExperience'] = expMatch;
        console.log(`⏰ Experience match: ${menteePrefs.YearsExperience} vs ${mentorMeta.YearExp} = ${expMatch}`);
      }

      // Mentoring style match - SKIPPED for now (user has another idea)
      // if (menteePrefs.MentoringStyle && mentorMeta.MentoringStyle) {
      //   const styleMatch = calculateMentoringStyleMatch(menteePrefs.MentoringStyle, mentorMeta.MentoringStyle);
      //   factorScores['mentoringStyle'] = styleMatch;
      //   console.log(`🎯 Mentoring style match: "${menteePrefs.MentoringStyle}" vs "${mentorMeta.MentoringStyle}" = ${styleMatch}`);
      // }

      // Previous roles match - FIXED: compare with PreviousRoles field
      if (menteePrefs.PreviousRoles && mentorMeta.PreviousRoles) {
        const previousRolesMatch = calculatePreviousRolesMatch(menteePrefs.PreviousRoles, mentorMeta.PreviousRoles);
        factorScores['previousRoles'] = previousRolesMatch;
        console.log(`🔄 Previous roles match: "${menteePrefs.PreviousRoles}" vs "${mentorMeta.PreviousRoles}" = ${previousRolesMatch}`);
      }

      // Cultural background match - FIXED: compare with CulturalBackground field
      if (menteePrefs.CultureBackground && mentorMeta.CulturalBackground) {
        const culturalMatch = calculateCulturalMatch(menteePrefs.CultureBackground, mentorMeta.CulturalBackground);
        factorScores['culturalBackground'] = culturalMatch;
        console.log(`🌍 Cultural match: "${menteePrefs.CultureBackground}" vs "${mentorMeta.CulturalBackground}" = ${culturalMatch}`);
      }

      // Availability match - FIXED: compare with Availability field
      if (menteePrefs.Availability && mentorMeta.Availability) {
        const availabilityMatch = calculateAvailabilityMatch(menteePrefs.Availability, mentorMeta.Availability);
        factorScores['availability'] = availabilityMatch;
        console.log(`📅 Availability match: "${menteePrefs.Availability}" vs "${mentorMeta.Availability}" = ${availabilityMatch}`);
      }

      console.log("📊 Factor scores:", factorScores);
      console.log("🎯 Factor order:", factorOrder);

      // Apply priority-based weighting
      if (factorOrder.length > 0) {
        // Top priority (35% weight)
        if (factorOrder[0] && factorScores[factorOrder[0]] !== undefined) {
          const weight = 0.35;
          const score = factorScores[factorOrder[0]] * weight;
          preferenceScore += score;
          console.log(`🥇 Top priority "${factorOrder[0]}": ${factorScores[factorOrder[0]]} × ${weight} = +${score.toFixed(3)}`);
        }

        // Second priority (25% weight)
        if (factorOrder[1] && factorScores[factorOrder[1]] !== undefined) {
          const weight = 0.25;
          const score = factorScores[factorOrder[1]] * weight;
          preferenceScore += score;
          console.log(`🥈 Second priority "${factorOrder[1]}": ${factorScores[factorOrder[1]]} × ${weight} = +${score.toFixed(3)}`);
        }

        // Third priority (10% weight)
        if (factorOrder[2] && factorScores[factorOrder[2]] !== undefined) {
          const weight = 0.10;
          const score = factorScores[factorOrder[2]] * weight;
          preferenceScore += score;
          console.log(`🥉 Third priority "${factorOrder[2]}": ${factorScores[factorOrder[2]]} × ${weight} = +${score.toFixed(3)}`);
        }

        // Remaining factors (30% weight distributed equally among available factors)
        const remainingFactors = factorOrder.slice(3).filter((factor: string) => factorScores[factor] !== undefined);
        if (remainingFactors.length > 0) {
          const remainingWeight = 0.30 / remainingFactors.length;
          for (const factor of remainingFactors) {
            const score = factorScores[factor] * remainingWeight;
            preferenceScore += score;
            console.log(`📋 Remaining factor "${factor}": ${factorScores[factor]} × ${remainingWeight.toFixed(3)} = +${score.toFixed(3)}`);
          }
        } else {
          // If no remaining factors available, redistribute weight to available factors
          const availableFactors = Object.keys(factorScores).filter(factor => factorScores[factor] !== undefined);
          if (availableFactors.length > 0) {
            const redistributedWeight = 0.30 / availableFactors.length;
            for (const factor of availableFactors) {
              const score = factorScores[factor] * redistributedWeight;
              preferenceScore += score;
              console.log(`🔄 Redistributed weight "${factor}": ${factorScores[factor]} × ${redistributedWeight.toFixed(3)} = +${score.toFixed(3)}`);
            }
          }
        }
      } else {
        // CRITICAL: If mentee has no FactorOrder, this should rarely happen
        // But if it does, we should still try to apply some logical weighting
        console.log(`⚠️ No FactorOrder found for mentee, applying fallback weighting`);
        const availableFactors = Object.keys(factorScores).filter(factor => factorScores[factor] !== undefined);
        if (availableFactors.length > 0) {
          // Apply a simple fallback: industry gets 40%, role gets 30%, others get equal remaining
          if (factorScores['currentIndustry'] !== undefined) {
            preferenceScore += factorScores['currentIndustry'] * 0.40;
            console.log(`🔄 Fallback industry: ${factorScores['currentIndustry']} × 0.40 = +${(factorScores['currentIndustry'] * 0.40).toFixed(3)}`);
          }
          if (factorScores['currentRole'] !== undefined) {
            preferenceScore += factorScores['currentRole'] * 0.30;
            console.log(`🔄 Fallback role: ${factorScores['currentRole']} × 0.30 = +${(factorScores['currentRole'] * 0.30).toFixed(3)}`);
          }
          
          const otherFactors = availableFactors.filter(factor => !['currentIndustry', 'currentRole'].includes(factor));
          if (otherFactors.length > 0) {
            const otherWeight = 0.30 / otherFactors.length;
            for (const factor of otherFactors) {
              const score = factorScores[factor] * otherWeight;
              preferenceScore += score;
              console.log(`🔄 Fallback other "${factor}": ${factorScores[factor]} × ${otherWeight.toFixed(3)} = +${score.toFixed(3)}`);
            }
          }
        }
      }

      console.log(`🎯 Final preference score: ${preferenceScore.toFixed(3)}`);
    }

    // Final score is 100% preference-based
    const finalScore = preferenceScore;
    
    // CRITICAL DEBUG: Always show the final calculation
    console.log(`🚀🚀🚀 FINAL CALCULATION 🚀🚀🚀`);
    console.log(`🚀 preferenceScore:`, preferenceScore);
    console.log(`🚀 finalScore:`, finalScore);
    console.log(`🚀 returning:`, {
      score: Math.round(100 * finalScore),
      preferenceScore: Math.round(100 * preferenceScore),
      breakdown: `Preference Score: ${Math.round(100 * preferenceScore)}%`
    });
    
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

// Smart industry matching function
function calculateIndustryMatch(menteeIndustry: string, mentorIndustry: string): number {
  if (!menteeIndustry || !mentorIndustry) return 0;
  
  // Normalize strings
  const mentee = menteeIndustry.toLowerCase().trim();
  const mentor = mentorIndustry.toLowerCase().trim();
  
  // 1. Exact match (highest score)
  if (mentee === mentor) {
    console.log(`   🎯 Exact industry match: "${menteeIndustry}" = "${mentorIndustry}"`);
    return 1.0;
  }
  
  // 2. Check if mentor industry is contained within mentee industry (perfect match)
  if (mentee.includes(mentor) || mentor.includes(mentee)) {
    console.log(`   🎯 Perfect industry match: "${menteeIndustry}" contains "${mentorIndustry}"`);
    return 1.0;
  }
  
  // 3. Extract keywords from both industries
  const menteeKeywords = extractIndustryKeywords(mentee);
  const mentorKeywords = extractIndustryKeywords(mentor);
  
  console.log(`   🔍 Mentee keywords: [${menteeKeywords.join(', ')}]`);
  console.log(`   🔍 Mentor keywords: [${mentorKeywords.join(', ')}]`);
  
  // 3. Calculate keyword overlap
  const overlappingKeywords = menteeKeywords.filter(keyword => 
    mentorKeywords.some(mentorKeyword => 
      keyword.includes(mentorKeyword) || mentorKeyword.includes(keyword)
    )
  );
  
  console.log(`   🔗 Overlapping keywords: [${overlappingKeywords.join(', ')}]`);
  
  // 4. Calculate match score based on overlap
  if (overlappingKeywords.length === 0) {
    console.log(`   ❌ No keyword overlap`);
    return 0;
  }
  
  // Score based on percentage of mentee keywords that match
  const matchPercentage = overlappingKeywords.length / menteeKeywords.length;
  const score = Math.min(matchPercentage, 1.0);
  
  console.log(`   ✅ Industry match score: ${score.toFixed(3)} (${overlappingKeywords.length}/${menteeKeywords.length} keywords)`);
  return score;
}

// Extract meaningful keywords from industry strings
function extractIndustryKeywords(industry: string): string[] {
  // Remove common filler words and punctuation
  const fillerWords = ['and', 'or', 'the', 'a', 'an', 'of', 'in', 'with', 'for', 'to', 'by'];
  const punctuation = /[,;()]/g;
  
  // Clean and split
  let cleaned = industry
    .replace(punctuation, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split into words and filter
  const words = cleaned.split(' ')
    .map(word => word.trim())
    .filter(word => 
      word.length > 2 && 
      !fillerWords.includes(word) &&
      !/^\d+$/.test(word) // Remove pure numbers
    );
  
  // Add some semantic variations
  const semanticKeywords = [];
  for (const word of words) {
    semanticKeywords.push(word);
    
    // Add related terms
    if (word.includes('account')) semanticKeywords.push('accounting', 'audit');
    if (word.includes('financ')) semanticKeywords.push('finance', 'banking', 'investment');
    if (word.includes('tech')) semanticKeywords.push('technology', 'software', 'it');
    if (word.includes('consult')) semanticKeywords.push('consulting', 'advisory');
    if (word.includes('startup')) semanticKeywords.push('startup', 'entrepreneur');
    if (word.includes('health')) semanticKeywords.push('healthcare', 'medical');
    if (word.includes('educat')) semanticKeywords.push('education', 'academic');
  }
  
  // Remove duplicates and return
  return [...new Set(semanticKeywords)];
}

// Helper functions (same as refresh-match)
function calculateRoleMatch(menteeRole: string, mentorRole: string): number {
  // Clear and exact role matching with typo tolerance and position variations
  if (!menteeRole || !mentorRole) return 0;
  
  const mentee = menteeRole.toLowerCase().trim();
  const mentor = mentorRole.toLowerCase().trim();
  
  // Exact match
  if (mentee === mentor) return 1.0;
  
  // Check if one contains the other (perfect match)
  if (mentee.includes(mentor) || mentor.includes(mentee)) return 1.0;
  
  // Position variations and synonyms
  const roleVariations = {
    'swe': ['software engineer', 'full stack developer', 'developer', 'programmer'],
    'full stack developer': ['swe', 'software engineer', 'developer', 'programmer'],
    'software engineer': ['swe', 'full stack developer', 'developer', 'programmer'],
    'internal auditor': ['auditor', 'senior internal auditor', 'assurance associate'],
    'auditor': ['internal auditor', 'external auditor', 'senior auditor', 'assurance associate'],
    'accountant': ['graduate accountant', 'senior accountant', 'financial accountant'],
    'finance': ['financial analyst', 'finance manager', 'financial advisor']
  };
  
  // Check for role variations
  for (const [key, variations] of Object.entries(roleVariations)) {
    if (mentee.includes(key) || variations.some(v => mentee.includes(v))) {
      if (mentor.includes(key) || variations.some(v => mentor.includes(v))) {
        return 1.0; // Perfect match through variations
      }
    }
  }
  
  // Check for key role matches
  if (mentee.includes('auditor') && mentor.includes('auditor')) return 1.0;
  if (mentee.includes('accountant') && mentor.includes('accountant')) return 1.0;
  if (mentee.includes('finance') && mentor.includes('finance')) return 1.0;
  if (mentee.includes('internal') && mentor.includes('internal')) return 1.0;
  if (mentee.includes('senior') && mentor.includes('senior')) return 1.0;
  
  return 0.0; // No match - roles are too different
}

function calculateSeniorityMatch(menteeSeniority: string, mentorSeniority: string): number {
  const seniorityLevels = {
    'Junior': 1,
    'Mid-level': 2,
    'Senior': 3,
    'Manager': 4,
    'Director': 5,
    'Executive': 6
  };

  const menteeLevel = seniorityLevels[menteeSeniority as keyof typeof seniorityLevels] || 1;
  const mentorLevel = seniorityLevels[mentorSeniority as keyof typeof seniorityLevels] || 1;

  // Mentor's hierarchy >= mentee's required hierarchy → 1.0
  if (mentorLevel >= menteeLevel) return 1.0;
  
  // If mentor is one level below → 0.6
  if (mentorLevel === menteeLevel - 1) return 0.6;
  
  // Otherwise → 0
  return 0;
}

function calculateExperienceMatch(menteeExp: number, mentorExp: number): number {
  // Experience matching: mentor should have >= required experience
  if (!menteeExp || !mentorExp) return 0;
  
  // 1. mentor's experiences ≥ required experiences year → 1.0
  if (mentorExp >= menteeExp) return 1.0;
  
  // 2. If mentor_years = required−1 → 0.7
  if (mentorExp === menteeExp - 1) return 0.7;
  
  // 3. otherwise → 0.1
  return 0.1;
}

function calculateMentoringStyleMatch(menteeStyle: string, mentorStyle: string): number {
  // Enhanced matching for mentoring styles
  if (!menteeStyle || !mentorStyle) return 0;
  
  const mentee = menteeStyle.toLowerCase().trim();
  const mentor = mentorStyle.toLowerCase().trim();
  
  // Exact match
  if (mentee === mentor) return 1.0;
  
  // Check if one contains the other (perfect match)
  if (mentee.includes(mentor) || mentor.includes(mentee)) return 1.0;
  
  // Similar styles get partial credit
  if (mentee.includes('coach') && mentor.includes('coach')) return 1.0;
  if (mentee.includes('task') && mentor.includes('task')) return 1.0;
  if (mentee.includes('mentor') && mentor.includes('mentor')) return 1.0;
  
  return 0.5; // Default score for other similar styles
}

function calculatePreviousRolesMatch(menteeRoles: string, mentorRoles: string): number {
  // Previous roles: mentee's roles must contain mentor's roles
  if (!menteeRoles || !mentorRoles) return 0;
  
  const mentee = menteeRoles.toLowerCase().trim();
  const mentor = mentorRoles.toLowerCase().trim();
  
  // Exact match
  if (mentee === mentor) return 1.0;
  
  // Check if mentee's roles contain mentor's roles (perfect match)
  if (mentee.includes(mentor) || mentor.includes(mentee)) return 1.0;
  
  // Check for key role matches
  if (mentee.includes('auditor') && mentor.includes('auditor')) return 1.0;
  if (mentee.includes('accountant') && mentor.includes('accountant')) return 1.0;
  if (mentee.includes('finance') && mentor.includes('finance')) return 1.0;
  if (mentee.includes('big 4') && mentor.includes('big 4')) return 1.0;
  
  return 0.0; // No match - mentor's roles don't fit mentee's requirements
}

function calculateCulturalMatch(menteeCulture: string, mentorCulture: string): number {
  // Cultural matching: mentor's culture should fall inside mentee's culture range
  if (!menteeCulture || !mentorCulture) return 0;
  
  const mentee = menteeCulture.toLowerCase().trim();
  const mentor = mentorCulture.toLowerCase().trim();
  
  // Exact match
  if (mentee === mentor) return 1.0;
  
  // Check if mentee's culture contains mentor's culture (perfect match)
  if (mentee.includes(mentor) || mentor.includes(mentee)) return 1.0;
  
  // Check for language matches
  if (mentee.includes('chinese') && mentor.includes('chinese')) return 1.0;
  if (mentee.includes('english') && mentor.includes('english')) return 1.0;
  if (mentee.includes('international') && mentor.includes('international')) return 1.0;
  
  return 0.0; // No match - mentor's culture doesn't fit mentee's requirements
}

function calculateAvailabilityMatch(menteeAvailability: string, mentorAvailability: string): number {
  // Availability matching: mentee's must contain mentor's
  if (!menteeAvailability || !mentorAvailability) return 0;
  
  const mentee = menteeAvailability.toLowerCase().trim();
  const mentor = mentorAvailability.toLowerCase().trim();
  
  // Exact match
  if (mentee === mentor) return 1.0;
  
  // Check if mentee's availability contains mentor's availability (perfect match)
  if (mentee.includes(mentor) || mentor.includes(mentee)) return 1.0;
  
  // Check for frequency matches
  if (mentee.includes('weekly') && mentor.includes('weekly')) return 1.0;
  if (mentee.includes('weekday') && mentor.includes('weekday')) return 1.0;
  if (mentee.includes('after hours') && mentor.includes('after hours')) return 1.0;
  if (mentee.includes('during the week') && mentor.includes('during the week')) return 1.0;
  
  return 0.0; // No match - mentor's availability doesn't fit mentee's requirements
}

// Tag overlap scoring function
function calculateTagOverlap(menteeTags: string[], mentorTags: string[]): number {
  if (menteeTags.length === 0 || mentorTags.length === 0) return 0;

  const uniqueMenteeTags = new Set(menteeTags);
  const uniqueMentorTags = new Set(mentorTags);

  const overlappingTags = Array.from(uniqueMenteeTags).filter(tag => uniqueMentorTags.has(tag));

  const overlapPercentage = overlappingTags.length / uniqueMenteeTags.size;
  return Math.min(overlapPercentage, 1.0);
}

export async function GET(req: NextRequest) {
  try {
    if (!ready) {
      return NextResponse.json({ error: "Airtable not configured" }, { status: 503 });
    }

    const token = req.cookies.get("session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let uid: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as any;
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    console.log(`🚀 Real-time mentor matching for mentee: ${uid}`);

    // 1. Fetch mentee preferences (real-time)
    const prefRows = await firstPage(AIRTABLE_MENTEE_PREFERENCES_TABLE!, {
      filterByFormula: `{UserID}='${esc(uid)}'`,
      fields: ["UserID", "CurrentIndustry", "CurrentRole", "SeniorityLevel", "PreviousRoles", "MentoringStyle", "YearsExperience", "CultureBackground", "Availability", "FactorOrder"],
      maxRecords: 1
    });

    if (!prefRows.length) {
      console.log("❌ No mentee preferences found");
      return NextResponse.json({ mentors: [] });
    }

    const menteePrefs = prefRows[0].fields;
    console.log("📥 Mentee preferences:", menteePrefs);

    // 1.5. Fetch mentee tags from MenteeMeta table
    const menteeMetaRows = await firstPage(AIRTABLE_MENTEE_META_TABLE!, {
      filterByFormula: `{UserID}='${esc(uid)}'`,
      fields: ["UserID", "Tags"],
      maxRecords: 1
    });

    let menteeTags: string[] = [];
    if (menteeMetaRows.length > 0 && menteeMetaRows[0].fields.Tags) {
      const rawTags = menteeMetaRows[0].fields.Tags;
      if (rawTags.value) {
        menteeTags = rawTags.value.split(',').map((tag: string) => tag.trim());
      }
    }
    console.log("🏷️ Mentee tags:", menteeTags);

    // 2. Fetch all mentors (real-time)
    const mentorRows = await firstPage(AIRTABLE_MENTOR_META_TABLE!, {
      fields: ["UserID", "Industry", "YearExp", "Skill", "Location", "Role", "Company", "SchoolName", "FieldOfStudy", "Tags", "UpdatedAt", "CurrentRole", "SeniorityLevel", "PreviousRoles", "MentoringStyle", "CulturalBackground", "Availability"]
    });

    console.log(`📥 Found ${mentorRows.length} total mentors`);

    // 3. Calculate fresh scores for each mentor (real-time)
    const mentorScores = [];
    
    console.log(`\n🚀 STARTING SCORING LOOP for ${mentorRows.length} mentors`);
    
    for (const mentorRow of mentorRows) {
      const mentorId = mentorRow.fields?.UserID;
      if (!mentorId) continue;

      // CRITICAL DEBUG: Always show when we start processing jKd3VERP8O
      if (mentorId === 'jKd3VERP8O') {
        console.log(`\n🎯🎯🎯 PROCESSING jKd3VERP8O - START 🎯🎯🎯`);
        console.log(`🎯 Raw mentorRow:`, JSON.stringify(mentorRow, null, 2));
        console.log(`🎯 mentorRow.fields:`, JSON.stringify(mentorRow.fields, null, 2));
      }

      // Debug: Show raw data for all mentors
      console.log(`\n📥 Raw data for mentor ${mentorId}:`, {
        UserID: mentorRow.fields?.UserID,
        Industry: mentorRow.fields?.Industry,
        YearExp: mentorRow.fields?.YearExp,
        CurrentRole: mentorRow.fields?.CurrentRole,
        SeniorityLevel: mentorRow.fields?.SeniorityLevel,
        PreviousRoles: mentorRow.fields?.PreviousRoles,
        MentoringStyle: mentorRow.fields?.MentoringStyle,
        CulturalBackground: mentorRow.fields?.CulturalBackground,
        Availability: mentorRow.fields?.Availability,
        Tags: mentorRow.fields?.Tags
      });

      const mentorMeta = {
        Industry: mentorRow.fields?.Industry,
        Role: mentorRow.fields?.Role,
        YearExp: mentorRow.fields?.YearExp,
        Skill: mentorRow.fields?.Skill,
        Location: mentorRow.fields?.Location,
        Company: mentorRow.fields?.Company,
        SchoolName: mentorRow.fields?.SchoolName,
        FieldOfStudy: mentorRow.fields?.FieldOfStudy,
        Tags: mentorRow.fields?.Tags,
        UpdatedAt: mentorRow.fields?.UpdatedAt,
        // New fields for proper preference matching
        CurrentRole: mentorRow.fields?.CurrentRole,
        SeniorityLevel: mentorRow.fields?.SeniorityLevel,
        PreviousRoles: mentorRow.fields?.PreviousRoles,
        MentoringStyle: mentorRow.fields?.MentoringStyle,
        CulturalBackground: mentorRow.fields?.CulturalBackground,
        Availability: mentorRow.fields?.Availability
      };

      // CRITICAL DEBUG: Show mentorMeta for jKd3VERP8O after it's declared
      if (mentorId === 'jKd3VERP8O') {
        console.log(`🎯 About to call calculatePreferenceScore with:`, {
          menteePrefs: menteePrefs,
          mentorMeta: mentorMeta
        });
      }

      console.log(`\n🔍 Scoring mentor ${mentorId}:`, {
        Industry: mentorMeta.Industry,
        Role: mentorMeta.Role,
        YearExp: mentorMeta.YearExp,
        Tags: mentorMeta.Tags,
        // Add preference fields debugging for ALL mentors
        CurrentRole: mentorMeta.CurrentRole,
        SeniorityLevel: mentorMeta.SeniorityLevel,
        PreviousRoles: mentorMeta.PreviousRoles,
        MentoringStyle: mentorMeta.MentoringStyle,
        CulturalBackground: mentorMeta.CulturalBackground,
        Availability: mentorMeta.Availability
      });

      // Calculate fresh score
      console.log(`🎯 About to call calculatePreferenceScore for ${mentorId}`);
      const scoreResult = calculatePreferenceScore(menteePrefs, mentorMeta);
      console.log(`🎯 calculatePreferenceScore returned for ${mentorId}:`, scoreResult);

      // Calculate tag score (30% weight)
      let tagScore = 0;
      let tagBreakdown = "";
      if (menteeTags.length > 0 && mentorMeta.Tags) {
        const mentorTags = normalizeTags(mentorMeta.Tags);
        if (mentorTags.length > 0) {
          const tagOverlap = calculateTagOverlap(menteeTags, mentorTags);
          tagScore = tagOverlap * 30; // 30% weight
          tagBreakdown = `Tag Overlap: ${(tagOverlap * 100).toFixed(1)}%`;
          console.log(`🏷️ Tag scoring for ${mentorId}: mentee tags [${menteeTags.join(', ')}] vs mentor tags [${mentorTags.join(', ')}] = ${(tagOverlap * 100).toFixed(1)}% overlap = ${tagScore.toFixed(1)} points`);
        }
      }

      // Calculate final score: 30% tags + 70% preferences
      const finalScore = Math.round(tagScore + (scoreResult.preferenceScore * 0.7));
      const finalBreakdown = `${tagBreakdown ? tagBreakdown + ' | ' : ''}Preferences: ${scoreResult.breakdown}`;

      console.log(`🚀🚀🚀 FINAL CALCULATION 🚀🚀🚀`);
      console.log(`🚀 tagScore: ${tagScore}`);
      console.log(`🚀 preferenceScore: ${scoreResult.preferenceScore}`);
      console.log(`🚀 finalScore: ${finalScore}`);
      console.log(`🚀 returning: { score: ${finalScore}, preferenceScore: ${scoreResult.preferenceScore}, tagScore: ${tagScore}, breakdown: '${finalBreakdown}' }`);

      mentorScores.push({
        mentorId,
        score: finalScore,
        preferenceScore: scoreResult.preferenceScore,
        tagScore: tagScore,
        breakdown: finalBreakdown
      });

      console.log(`📊 Score result for ${mentorId}:`, {
        score: finalScore,
        preferenceScore: scoreResult.preferenceScore,
        tagScore: tagScore,
        breakdown: finalBreakdown
      });
    }

    // Sort by score (highest first)
    mentorScores.sort((a, b) => b.score - a.score);

    console.log(`🔄 Calculated ${mentorScores.length} mentor scores`);
    console.log(`🏆 Top 5 scores:`, mentorScores.slice(0, 5));

    // Return top mentors
    const topMentors = mentorScores.slice(0, 1); // Return top 1 for now
    console.log(`🏆 Returning ${topMentors.length} mentors with highest score ${topMentors[0]?.score}`);

    // Transform to match expected format
    const mentors = topMentors.map(scoreData => {
      const meta = mentorRows.find(r => r.fields?.UserID === scoreData.mentorId)?.fields;
      if (!meta) return null;

      return {
        userId: scoreData.mentorId,
        name: null, // Will be populated by frontend
        bio: null,  // Will be populated by frontend
        linkedIn: null, // Will be populated by frontend
        industry: clean(meta.Industry) ?? null,
        yearExp: meta.YearExp ?? null,
        skill: clean(meta.Skill) ?? null,
        location: clean(meta.Location) ?? null,
        role: clean(meta.Role) ?? null,
        company: clean(meta.Company) ?? null,
        schoolName: clean(meta.SchoolName) ?? null,
        fieldOfStudy: clean(meta.FieldOfStudy) ?? null,
        tags: normalizeTags(meta.Tags),
        metaUpdatedAt: meta.UpdatedAt ?? null,
        // New preference matching fields
        currentRole: clean(meta.CurrentRole) ?? null,
        seniorityLevel: clean(meta.SeniorityLevel) ?? null,
        previousRoles: clean(meta.PreviousRoles) ?? null,
        mentoringStyle: clean(meta.MentoringStyle) ?? null,
        culturalBackground: clean(meta.CulturalBackground) ?? null,
        availability: clean(meta.Availability) ?? null,
        // Enhanced scoring data
        score: scoreData.score,
        preferenceScore: scoreData.preferenceScore,
        tagScore: scoreData.tagScore,
        breakdown: scoreData.breakdown
      };
    }).filter(Boolean);
    
    console.log(`✅ Returning ${mentors.length} fresh mentor matches`);
    return NextResponse.json({ mentors });

  } catch (e: any) {
    const status = e?.statusCode || e?.status || 500;
    const msg =
      e?.code === "ETIMEDOUT"
        ? "Airtable timed out. Please retry."
        : e?.message || "Server error";
    console.error("❌ Mentor match error:", e);
    return NextResponse.json({ error: msg }, { status });
  }
}