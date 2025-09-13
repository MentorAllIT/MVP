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
  
  try {
    
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
      }

      // Role match - FIXED: compare with CurrentRole field
      if (menteePrefs.CurrentRole && mentorMeta.CurrentRole) {
        const roleMatch = calculateRoleMatch(menteePrefs.CurrentRole, mentorMeta.CurrentRole);
        factorScores['currentRole'] = roleMatch;
      }

      // Seniority match - FIXED: compare with SeniorityLevel field
      if (menteePrefs.SeniorityLevel && mentorMeta.SeniorityLevel) {
        const seniorityMatch = calculateSeniorityMatch(menteePrefs.SeniorityLevel, mentorMeta.SeniorityLevel);
        factorScores['seniorityLevel'] = seniorityMatch;
      }

      // Years of experience match
      if (menteePrefs.YearsExperience && mentorMeta.YearExp) {
        const expMatch = calculateExperienceMatch(menteePrefs.YearsExperience, mentorMeta.YearExp);
        factorScores['yearsExperience'] = expMatch;
      }

      // Mentoring style match - UPDATED: use RequiredMentoringStyles for scoring
      if (menteePrefs.RequiredMentoringStyles && mentorMeta.RequiredMentoringStyles) {
        const styleMatch = calculateMentoringStyleMatch(menteePrefs.RequiredMentoringStyles, mentorMeta.RequiredMentoringStyles);
        factorScores['mentoringStyle'] = styleMatch;
      }

      // Previous roles match - FIXED: compare with PreviousRoles field
      if (menteePrefs.PreviousRoles && mentorMeta.PreviousRoles) {
        const previousRolesMatch = calculatePreviousRolesMatch(menteePrefs.PreviousRoles, mentorMeta.PreviousRoles);
        factorScores['previousRoles'] = previousRolesMatch;
      }

      // Cultural background match - FIXED: compare with CulturalBackground field
      if (menteePrefs.CultureBackground && mentorMeta.CulturalBackground) {
        const culturalMatch = calculateCulturalMatch(menteePrefs.CultureBackground, mentorMeta.CulturalBackground);
        factorScores['culturalBackground'] = culturalMatch;
      }

      // Availability match - FIXED: compare with Availability field
      if (menteePrefs.Availability && mentorMeta.Availability) {
        const availabilityMatch = calculateAvailabilityMatch(menteePrefs.Availability, mentorMeta.Availability);
        factorScores['availability'] = availabilityMatch;
      }

      // Company match - NEW: compare with CurrentCompany field
      if (menteePrefs.CurrentCompany && mentorMeta.CurrentCompany) {
        const companyMatch = calculateCompanyMatch(menteePrefs.CurrentCompany, mentorMeta.CurrentCompany);
        factorScores['dreamCompanies'] = companyMatch;
      }


      // Apply priority-based weighting
      if (factorOrder.length > 0) {
        // Top priority (35% weight)
        if (factorOrder[0] && factorScores[factorOrder[0]] !== undefined) {
          const weight = 0.35;
          const score = factorScores[factorOrder[0]] * weight;
          preferenceScore += score;
        }

        // Second priority (25% weight)
        if (factorOrder[1] && factorScores[factorOrder[1]] !== undefined) {
          const weight = 0.25;
          const score = factorScores[factorOrder[1]] * weight;
          preferenceScore += score;
        }

        // Third priority (10% weight)
        if (factorOrder[2] && factorScores[factorOrder[2]] !== undefined) {
          const weight = 0.10;
          const score = factorScores[factorOrder[2]] * weight;
          preferenceScore += score;
        }

        // Remaining factors (30% weight distributed equally among available factors)
        const remainingFactors = factorOrder.slice(3).filter((factor: string) => factorScores[factor] !== undefined);
        if (remainingFactors.length > 0) {
          const remainingWeight = 0.30 / remainingFactors.length;
          for (const factor of remainingFactors) {
            const score = factorScores[factor] * remainingWeight;
            preferenceScore += score;
          }
        } else {
          // If no remaining factors available, redistribute weight to available factors
          const availableFactors = Object.keys(factorScores).filter(factor => factorScores[factor] !== undefined);
          if (availableFactors.length > 0) {
            const redistributedWeight = 0.30 / availableFactors.length;
            for (const factor of availableFactors) {
              const score = factorScores[factor] * redistributedWeight;
              preferenceScore += score;
            }
          }
        }
      } else {
        // CRITICAL: If mentee has no FactorOrder, this should rarely happen
        // But if it does, we should still try to apply some logical weighting
        const availableFactors = Object.keys(factorScores).filter(factor => factorScores[factor] !== undefined);
        if (availableFactors.length > 0) {
          // Apply a simple fallback: industry gets 40%, role gets 30%, others get equal remaining
          if (factorScores['currentIndustry'] !== undefined) {
            preferenceScore += factorScores['currentIndustry'] * 0.40;
          }
          if (factorScores['currentRole'] !== undefined) {
            preferenceScore += factorScores['currentRole'] * 0.30;
          }
          
          const otherFactors = availableFactors.filter(factor => !['currentIndustry', 'currentRole'].includes(factor));
          if (otherFactors.length > 0) {
            const otherWeight = 0.30 / otherFactors.length;
            for (const factor of otherFactors) {
              const score = factorScores[factor] * otherWeight;
              preferenceScore += score;
            }
          }
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
    return 1.0;
  }
  
  // 2. Check if mentor industry is contained within mentee industry (perfect match)
  if (mentee.includes(mentor) || mentor.includes(mentee)) {
    return 1.0;
  }
  
  // 3. Extract keywords from both industries
  const menteeKeywords = extractIndustryKeywords(mentee);
  const mentorKeywords = extractIndustryKeywords(mentor);
  
  
  // 3. Calculate keyword overlap
  const overlappingKeywords = menteeKeywords.filter(keyword => 
    mentorKeywords.some(mentorKeyword => 
      keyword.includes(mentorKeyword) || mentorKeyword.includes(keyword)
    )
  );
  
  
  // 4. Calculate match score based on overlap
  if (overlappingKeywords.length === 0) {
    return 0;
  }
  
  // Score based on percentage of mentee keywords that match
  const matchPercentage = overlappingKeywords.length / menteeKeywords.length;
  const score = Math.min(matchPercentage, 1.0);
  
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

// Update the mentoring style matching function
function calculateMentoringStyleMatch(menteeStyles: string | string[], mentorStyle: string | string[]): number {
  if (!menteeStyles || !mentorStyle) return 0;

  // Handle "I don't mind" case for mentees (uses "I don't mind any mentoring style")
  const menteeDontMind = menteeStyles === 'dont_mind' || 
                        menteeStyles === "I don't mind any mentoring style" ||
                        (Array.isArray(menteeStyles) && (
                          menteeStyles.includes('dont_mind') || 
                          menteeStyles.includes("I don't mind any mentoring style")
                        ));
  
  if (menteeDontMind) {
    return 1.0; // Full score for all mentors
  }

  // Handle "I don't mind" case for mentors (uses "I don't have any particular mentoring style")
  const mentorDontMind = mentorStyle === 'dont_mind' || 
                        mentorStyle === "I don't have any particular mentoring style" ||
                        mentorStyle === "I dont have any particular mentoring style" ||
                        (Array.isArray(mentorStyle) && (
                          mentorStyle.includes('dont_mind') || 
                          mentorStyle.includes("I don't have any particular mentoring style") ||
                          mentorStyle.includes("I dont have any particular mentoring style")
                        ));
  
  if (mentorDontMind) {
    return 1.0; // Full score for mentees
  }

  // Extract required styles from mentee preferences
  let requiredStyles: string[] = [];
  if (typeof menteeStyles === 'string') {
    // RequiredMentoringStyles is already in the correct format (comma-separated)
    requiredStyles = menteeStyles.split(',').map(s => s.trim()).filter(s => s);
  } else if (Array.isArray(menteeStyles)) {
    requiredStyles = menteeStyles;
  }

  // If no required styles, return 0
  if (requiredStyles.length === 0) return 0;

  // Convert mentor styles to array
  let mentorStyleArray: string[] = [];
  if (typeof mentorStyle === 'string') {
    mentorStyleArray = mentorStyle.split(',').map((s: string) => s.trim()).filter(s => s);
  } else if (Array.isArray(mentorStyle)) {
    mentorStyleArray = mentorStyle;
  }

  // If no mentor styles, return 0
  if (mentorStyleArray.length === 0) return 0;

  // Calculate overlap percentage for required styles only
  const overlappingStyles = requiredStyles.filter((style: string) =>
    mentorStyleArray.some((mentorStyle: string) =>
      style.toLowerCase().includes(mentorStyle.toLowerCase()) ||
      mentorStyle.toLowerCase().includes(style.toLowerCase())
    )
  );

  if (overlappingStyles.length === 0) return 0;

  // Return percentage of required styles that match
  return overlappingStyles.length / requiredStyles.length;
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

// Company matching function - SIMPLIFIED: Binary match (1 or 0)
function calculateCompanyMatch(menteeCompanies: string, mentorCompany: string): number {
  if (!menteeCompanies || !mentorCompany) return 0;
  
  // Split mentee's companies (comma-separated or newline-separated)
  const menteeCompanyList = menteeCompanies
    .split(/[,\n]/)
    .map(company => company.trim().toLowerCase())
    .filter(company => company.length > 0);
  
  if (menteeCompanyList.length === 0) return 0;
  
  const mentorCompanyLower = mentorCompany.trim().toLowerCase();
  
  // Simple binary check: if mentor's company is found in mentee's list, return 1, otherwise 0
  for (const company of menteeCompanyList) {
    if (company === mentorCompanyLower) {
      return 1.0; // Perfect match - mentor's company is in mentee's preferred list
    }
  }
  
  return 0.0; // No match - mentor's company is not in mentee's preferred list
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


    // 1. Fetch mentee preferences (real-time)
    const prefRows = await firstPage(AIRTABLE_MENTEE_PREFERENCES_TABLE!, {
      filterByFormula: `{UserID}='${esc(uid)}'`,
      fields: ["UserID", "CurrentIndustry", "CurrentRole", "SeniorityLevel", "PreviousRoles", "RequiredMentoringStyles", "NicetohaveStyles", "YearsExperience", "CultureBackground", "Availability", "CurrentCompany", "FactorOrder"],
      maxRecords: 1
    });

    if (!prefRows.length) {
      return NextResponse.json({ mentors: [] });
    }

    const menteePrefs = prefRows[0].fields;

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

    // 2. Fetch all mentors (real-time)
    const mentorRows = await firstPage(AIRTABLE_MENTOR_META_TABLE!, {
      fields: ["UserID", "Industry", "YearExp", "Skill", "Location", "Role", "Company", "SchoolName", "FieldOfStudy", "Tags", "UpdatedAt", "CurrentRole", "CurrentCompany", "SeniorityLevel", "PreviousRoles", "RequiredMentoringStyles", "CulturalBackground", "Availability"]
    });

    // 2.5. Fetch mentor names from Users table
    const mentorIds = mentorRows.map(row => row.fields?.UserID).filter(Boolean);
    const userRows = await firstPage(AIRTABLE_USERS_TABLE!, {
      filterByFormula: `OR(${mentorIds.map(id => `{UserID}='${esc(id)}'`).join(',')})`,
      fields: ["UserID", "Name"]
    });

    // 2.6. Fetch mentor profiles from Profiles table
    const profileRows = await firstPage(AIRTABLE_PROFILES_TABLE!, {
      filterByFormula: `OR(${mentorIds.map(id => `{UserID}='${esc(id)}'`).join(',')})`,
      fields: ["UserID", "Bio", "LinkedIn"]
    });


    // 3. Calculate fresh scores for each mentor (real-time)
    const mentorScores = [];
    
    
    for (const mentorRow of mentorRows) {
      const mentorId = mentorRow.fields?.UserID;
      if (!mentorId) continue;

      // CRITICAL DEBUG: Always show when we start processing jKd3VERP8O
      if (mentorId === 'jKd3VERP8O') {
      }

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
        CurrentCompany: mentorRow.fields?.CurrentCompany,
        SeniorityLevel: mentorRow.fields?.SeniorityLevel,
        PreviousRoles: mentorRow.fields?.PreviousRoles,
        RequiredMentoringStyles: mentorRow.fields?.RequiredMentoringStyles,
        CulturalBackground: mentorRow.fields?.CulturalBackground,
        Availability: mentorRow.fields?.Availability
      };

      // CRITICAL DEBUG: Show mentorMeta for jKd3VERP8O after it's declared
      if (mentorId === 'jKd3VERP8O') {
      }


      // Calculate fresh score
      const scoreResult = calculatePreferenceScore(menteePrefs, mentorMeta);

      // Calculate tag score (30% weight)
      let tagScore = 0;
      let tagBreakdown = "";
      if (menteeTags.length > 0 && mentorMeta.Tags) {
        const mentorTags = normalizeTags(mentorMeta.Tags);
        if (mentorTags.length > 0) {
          const tagOverlap = calculateTagOverlap(menteeTags, mentorTags);
          tagScore = tagOverlap * 30; // 30% weight
          tagBreakdown = `Tag Overlap: ${(tagOverlap * 100).toFixed(1)}%`;
        }
      }

      // Calculate final score: 30% tags + 70% preferences
      const finalScore = Math.round(tagScore + (scoreResult.preferenceScore * 0.7));
      const finalBreakdown = `${tagBreakdown ? tagBreakdown + ' | ' : ''}Preferences: ${scoreResult.breakdown}`;


      mentorScores.push({
        mentorId,
        score: finalScore,
        preferenceScore: scoreResult.preferenceScore,
        tagScore: tagScore,
        breakdown: finalBreakdown
      });
    }

    // Sort by score (highest first)
    mentorScores.sort((a, b) => b.score - a.score);


    // Return top mentors
    const topMentors = mentorScores.slice(0, 1); // Return top 1 for now

    // Transform to match expected format
    const mentors = topMentors.map(scoreData => {
      const meta = mentorRows.find(r => r.fields?.UserID === scoreData.mentorId)?.fields;
      if (!meta) return null;

      // Find user data
      const userData = userRows.find(r => r.fields?.UserID === scoreData.mentorId)?.fields;
      const profileData = profileRows.find(r => r.fields?.UserID === scoreData.mentorId)?.fields;

      return {
        userId: scoreData.mentorId,
        name: clean(userData?.Name) ?? null,
        bio: clean(profileData?.Bio) ?? null,
        linkedIn: clean(profileData?.LinkedIn) ?? null,
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
        mentoringStyle: clean(meta.RequiredMentoringStyles) ?? null,
        culturalBackground: clean(meta.CulturalBackground) ?? null,
        availability: clean(meta.Availability) ?? null,
        // Enhanced scoring data
        score: scoreData.score,
        preferenceScore: scoreData.preferenceScore,
        tagScore: scoreData.tagScore,
        breakdown: scoreData.breakdown
      };
    }).filter(Boolean);
    
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