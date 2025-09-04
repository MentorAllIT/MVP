import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

export const dynamic = "force-dynamic";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_USERS_TABLE,
  AIRTABLE_MENTEE_PREFERENCES_TABLE,
  AIRTABLE_MENTOR_META_TABLE,
  AIRTABLE_MATCH_RANKING_TABLE,
} = process.env;

const ready =
  AIRTABLE_API_KEY &&
  AIRTABLE_BASE_ID &&
  AIRTABLE_USERS_TABLE &&
  AIRTABLE_MENTEE_PREFERENCES_TABLE &&
  AIRTABLE_MENTOR_META_TABLE &&
  AIRTABLE_MATCH_RANKING_TABLE;

let base: any = null;
if (ready) base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);

const esc = (s: string) => String(s).replace(/'/g, "\\'");

export async function GET(request: NextRequest) {
  try {
    if (!ready) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const menteeId = searchParams.get("menteeId");
    
    if (!menteeId) {
      return NextResponse.json({ error: "menteeId parameter required" }, { status: 400 });
    }


    // 1. Get mentee preferences
    const [prefRec] = await base(AIRTABLE_MENTEE_PREFERENCES_TABLE!).select({
      filterByFormula: `{UserID}='${esc(menteeId)}'`,
      maxRecords: 1,
      fields: ["CurrentIndustry", "CurrentRole", "SeniorityLevel", "PreviousRoles", "MentoringStyle", "YearsExperience", "CultureBackground", "Availability", "FactorOrder"]
    }).firstPage();

    if (!prefRec) {
      return NextResponse.json({ error: "Mentee preferences not found" }, { status: 404 });
    }


    // 2. Get current match rankings
    const matchRows = await base(AIRTABLE_MATCH_RANKING_TABLE!).select({
      filterByFormula: `{MenteeID}='${esc(menteeId)}'`,
      fields: ["MenteeID", "MentorID", "Score", "PreferenceScore", "TagScore", "Breakdown", "UpdatedAt"],
      sort: [{ field: "Score", direction: "desc" }]
    }).all();

    const currentMatches = matchRows.map((r: any) => ({
      mentorId: r.fields?.MentorID,
      score: r.fields?.Score,
      preferenceScore: r.fields?.PreferenceScore,
      breakdown: r.fields?.Breakdown
    }));

    // 3. Get all mentors to recalculate scores
    const allMentors = await base(AIRTABLE_MENTOR_META_TABLE!).select({
      fields: ["UserID", "Industry", "Role", "YearExp"]
    }).all();


    // 4. Recalculate scores for all mentors
    const recalculatedScores = [];
    
    for (const mentor of allMentors) {
      const mentorId = mentor.fields?.UserID;
      if (!mentorId) continue;

      const mentorMeta = {
        Industry: mentor.fields?.Industry,
        Role: mentor.fields?.Role,
        YearExp: mentor.fields?.YearExp
      };

      // Simple score calculation for debugging
      let score = 0;
      let breakdown = [];

      // Industry match
      if (prefRec.fields.CurrentIndustry && mentorMeta.Industry) {
        if (prefRec.fields.CurrentIndustry.toLowerCase() === mentorMeta.Industry.toLowerCase()) {
          score += 35;
          breakdown.push("Industry: +35");
        }
      }

      // Role match
      if (prefRec.fields.CurrentRole && mentorMeta.Role) {
        if (prefRec.fields.CurrentRole.toLowerCase() === mentorMeta.Role.toLowerCase()) {
          score += 25;
          breakdown.push("Role: +25");
        }
      }

      // Seniority match
      if (prefRec.fields.SeniorityLevel && mentorMeta.Role) {
        const menteeLevel = prefRec.fields.SeniorityLevel.toLowerCase();
        const mentorRole = mentorMeta.Role.toLowerCase();
        
        if (menteeLevel === "junior" && mentorRole.includes("senior")) {
          score += 20;
          breakdown.push("Seniority: +20");
        } else if (menteeLevel === "mid-level" && (mentorRole.includes("senior") || mentorRole.includes("manager"))) {
          score += 20;
          breakdown.push("Seniority: +20");
        }
      }

      // Years of experience match
      if (prefRec.fields.YearsExperience && mentorMeta.YearExp) {
        const menteeExp = parseInt(prefRec.fields.YearsExperience) || 0;
        const mentorExp = parseInt(mentorMeta.YearExp) || 0;
        
        if (Math.abs(mentorExp - menteeExp) <= 2) {
          score += 20;
          breakdown.push("Experience: +20");
        }
      }

      if (score > 0) {
        recalculatedScores.push({
          mentorId,
          score,
          breakdown: breakdown.join(", "),
          mentorMeta
        });
      }
    }

    // Sort by score descending
    recalculatedScores.sort((a, b) => b.score - a.score);


    // 5. Check specific mentors mentioned in the issue
    const specificMentors = ["jKd3VERP8O", "xLUZEWvLXI"];
    const specificMentorData = [];
    
    for (const mentorId of specificMentors) {
      const mentor = allMentors.find((m: any) => m.fields?.UserID === mentorId);
      if (mentor) {
        const mentorMeta = {
          Industry: mentor.fields?.Industry,
          Role: mentor.fields?.Role,
          YearExp: mentor.fields?.YearExp
        };
        
        // Find in recalculated scores
        const recalculatedScore = recalculatedScores.find((s: any) => s.mentorId === mentorId);
        
        // Find in current match rankings
        const currentRanking = matchRows.find((r: any) => r.fields?.MentorID === mentorId);
        
        specificMentorData.push({
          mentorId,
          mentorMeta,
          recalculatedScore: recalculatedScore ? {
            score: recalculatedScore.score,
            breakdown: recalculatedScore.breakdown
          } : null,
          currentRanking: currentRanking ? {
            score: currentRanking.fields?.Score,
            preferenceScore: currentRanking.fields?.PreferenceScore,
            breakdown: currentRanking.fields?.Breakdown
          } : null
        });
      }
    }

    return NextResponse.json({
      menteeId,
      menteePreferences: prefRec.fields,
      currentMatchRankings: matchRows.map((r: any) => ({
        mentorId: r.fields?.MentorID,
        score: r.fields?.Score,
        preferenceScore: r.fields?.PreferenceScore,
        breakdown: r.fields?.Breakdown
      })),
      recalculatedScores: recalculatedScores.slice(0, 20), // Top 20
      specificMentorAnalysis: specificMentorData,
      totalMentors: allMentors.length,
      totalScores: recalculatedScores.length
    });

  } catch (error) {
    console.error("❌ Debug error:", error);
    return NextResponse.json({ 
      error: "Debug failed", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
