import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

// Environment variables
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_MENTEE_PREFERENCES_TABLE = process.env.AIRTABLE_MENTEE_PREFERENCES_TABLE;
const AIRTABLE_MENTOR_META_TABLE = process.env.AIRTABLE_MENTOR_META_TABLE;

// Check if backend is ready
const ready = AIRTABLE_BASE_ID && AIRTABLE_API_KEY && AIRTABLE_MENTEE_PREFERENCES_TABLE && AIRTABLE_MENTOR_META_TABLE;

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
  
  // 4. Calculate keyword overlap
  const overlappingKeywords = menteeKeywords.filter(keyword => 
    mentorKeywords.some(mentorKeyword => 
      keyword.includes(mentorKeyword) || mentorKeyword.includes(keyword)
    )
  );
  
  // 5. Calculate match score based on overlap
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

// Helper functions
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

export async function GET(req: NextRequest) {
  try {
    if (!ready) return NextResponse.json({ error: "Backend not configured" }, { status: 503 });

    // Get mentee ID from query params
    const { searchParams } = new URL(req.url);
    const menteeId = searchParams.get('menteeId') || 'UDk1QK6HZ1'; // Default to the mentee we've been testing


    // 1. Fetch mentee preferences
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);
    const prefRows = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).select({
      filterByFormula: `{UserID}='${menteeId}'`,
      fields: ["UserID", "CurrentIndustry", "CurrentRole", "SeniorityLevel", "PreviousRoles", "MentoringStyle", "YearsExperience", "CultureBackground", "Availability", "FactorOrder"],
      maxRecords: 1
    }).firstPage();

    if (!prefRows.length) {
      return NextResponse.json({ error: "No mentee preferences found" });
    }

    const menteePrefs = prefRows[0].fields;

    // 2. Fetch all mentors
    const mentorRows = await base(AIRTABLE_MENTOR_META_TABLE!).select({
      fields: ["UserID", "Industry", "YearExp", "Skill", "Location", "Role", "Company", "SchoolName", "FieldOfStudy", "Tags", "UpdatedAt", "CurrentRole", "SeniorityLevel", "PreviousRoles", "MentoringStyle", "CulturalBackground", "Availability"]
    }).firstPage();


    // 3. Calculate scores for each mentor with detailed breakdown
    const mentorBreakdowns = [];
    
    for (const mentorRow of mentorRows) {
      const mentorId = mentorRow.fields?.UserID;
      if (!mentorId) continue;

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
        CurrentRole: mentorRow.fields?.CurrentRole,
        SeniorityLevel: mentorRow.fields?.SeniorityLevel,
        PreviousRoles: mentorRow.fields?.PreviousRoles,
        MentoringStyle: mentorRow.fields?.MentoringStyle,
        CulturalBackground: mentorRow.fields?.CulturalBackground,
        Availability: mentorRow.fields?.Availability
      };

      // Calculate individual factor scores
      const factorScores: { [key: string]: number } = {};
      let totalScore = 0;
      let breakdown = "";

      // Industry match (35% weight)
      if (menteePrefs.CurrentIndustry && mentorMeta.Industry) {
        const menteeIndustry = String(menteePrefs.CurrentIndustry);
        const mentorIndustry = String(mentorMeta.Industry);
        const industryMatch = calculateIndustryMatch(menteeIndustry, mentorIndustry);
        factorScores['currentIndustry'] = industryMatch;
        const industryScore = industryMatch * 0.35;
        totalScore += industryScore;
        breakdown += `Industry: ${(industryMatch * 100).toFixed(0)}% (${industryScore.toFixed(3)}) | `;
      }

      // Role match (25% weight)
      if (menteePrefs.CurrentRole && mentorMeta.CurrentRole) {
        const menteeRole = String(menteePrefs.CurrentRole);
        const mentorRole = String(mentorMeta.CurrentRole);
        const roleMatch = calculateRoleMatch(menteeRole, mentorRole);
        factorScores['currentRole'] = roleMatch;
        const roleScore = roleMatch * 0.25;
        totalScore += roleScore;
        breakdown += `Role: ${(roleMatch * 100).toFixed(0)}% (${roleScore.toFixed(3)}) | `;
      }

      // Seniority match (10% weight)
      if (menteePrefs.SeniorityLevel && mentorMeta.SeniorityLevel) {
        const menteeSeniority = String(menteePrefs.SeniorityLevel);
        const mentorSeniority = String(mentorMeta.SeniorityLevel);
        const seniorityMatch = calculateSeniorityMatch(menteeSeniority, mentorSeniority);
        factorScores['seniorityLevel'] = seniorityMatch;
        const seniorityScore = seniorityMatch * 0.10;
        totalScore += seniorityScore;
        breakdown += `Seniority: ${(seniorityMatch * 100).toFixed(0)}% (${seniorityScore.toFixed(3)}) | `;
      }

      // Previous roles match (7.5% weight)
      if (menteePrefs.PreviousRoles && mentorMeta.PreviousRoles) {
        const menteePrevRoles = String(menteePrefs.PreviousRoles);
        const mentorPrevRoles = String(mentorMeta.PreviousRoles);
        const previousRolesMatch = calculatePreviousRolesMatch(menteePrevRoles, mentorPrevRoles);
        factorScores['previousRoles'] = previousRolesMatch;
        const previousRolesScore = previousRolesMatch * 0.075;
        totalScore += previousRolesScore;
        breakdown += `Previous Roles: ${(previousRolesMatch * 100).toFixed(0)}% (${previousRolesScore.toFixed(3)}) | `;
      }

      // Experience match (7.5% weight)
      if (menteePrefs.YearsExperience && mentorMeta.YearExp) {
        const menteeExp = Number(menteePrefs.YearsExperience);
        const mentorExp = Number(mentorMeta.YearExp);
        if (!isNaN(menteeExp) && !isNaN(mentorExp)) {
          const expMatch = calculateExperienceMatch(menteeExp, mentorExp);
          factorScores['yearsExperience'] = expMatch;
          const expScore = expMatch * 0.075;
          totalScore += expScore;
          breakdown += `Experience: ${(expMatch * 100).toFixed(0)}% (${expScore.toFixed(3)}) | `;
        }
      }

      // Cultural match (7.5% weight)
      if (menteePrefs.CultureBackground && mentorMeta.CulturalBackground) {
        const menteeCulture = String(menteePrefs.CultureBackground);
        const mentorCulture = String(mentorMeta.CulturalBackground);
        const culturalMatch = calculateCulturalMatch(menteeCulture, mentorCulture);
        factorScores['culturalBackground'] = culturalMatch;
        const culturalScore = culturalMatch * 0.075;
        totalScore += culturalScore;
        breakdown += `Cultural: ${(culturalMatch * 100).toFixed(0)}% (${culturalScore.toFixed(3)}) | `;
      }

      // Availability match (7.5% weight)
      if (menteePrefs.Availability && mentorMeta.Availability) {
        const menteeAvailability = String(menteePrefs.Availability);
        const mentorAvailability = String(mentorMeta.Availability);
        const availabilityMatch = calculateAvailabilityMatch(menteeAvailability, mentorAvailability);
        factorScores['availability'] = availabilityMatch;
        const availabilityScore = availabilityMatch * 0.075;
        totalScore += availabilityScore;
        breakdown += `Availability: ${(availabilityMatch * 100).toFixed(0)}% (${availabilityScore.toFixed(3)}) | `;
      }

      // Remove trailing " | " and convert to percentage
      breakdown = breakdown.replace(/\s*\|\s*$/, '');
      const finalScore = Math.round(100 * totalScore);

      mentorBreakdowns.push({
        mentorId,
        score: finalScore,
        totalScore: totalScore,
        breakdown,
        factorScores,
        mentorMeta: {
          Industry: mentorMeta.Industry,
          CurrentRole: mentorMeta.CurrentRole,
          SeniorityLevel: mentorMeta.SeniorityLevel,
          PreviousRoles: mentorMeta.PreviousRoles,
          YearExp: mentorMeta.YearExp,
          CulturalBackground: mentorMeta.CulturalBackground,
          Availability: mentorMeta.Availability
        }
      });
    }

    // Sort by score (highest first)
    mentorBreakdowns.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      menteeId,
      menteePreferences: menteePrefs,
      totalMentors: mentorBreakdowns.length,
      mentorBreakdowns: mentorBreakdowns.slice(0, 50), // Top 50 for readability
      top10: mentorBreakdowns.slice(0, 10)
    });

  } catch (error) {
    console.error("❌ Error in all-mentors-breakdown:", error);
    return NextResponse.json({ error: `Internal server error: ${error}` }, { status: 500 });
  }
}
