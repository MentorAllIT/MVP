import { NextRequest, NextResponse } from "next/server";

// Tag overlap scoring function (same as in mentor-match)
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
    // Test mentee tags
    const menteeTags = ["Break Into Industry", "Explore and Clarify"];
    
    // Test different mentor tag scenarios
    const testCases = [
      {
        mentorTags: ["Break Into Industry", "Career Transition"],
        expected: "50% overlap (1/2 tags match)"
      },
      {
        mentorTags: ["Break Into Industry", "Explore and Clarify"],
        expected: "100% overlap (2/2 tags match)"
      },
      {
        mentorTags: ["Leadership", "Management"],
        expected: "0% overlap (no tags match)"
      },
      {
        mentorTags: ["Break Into Industry"],
        expected: "50% overlap (1/2 tags match)"
      },
      {
        mentorTags: [],
        expected: "0% overlap (no mentor tags)"
      }
    ];

    const results = testCases.map(testCase => {
      const overlap = calculateTagOverlap(menteeTags, testCase.mentorTags);
      const tagScore = overlap * 30; // 30% weight
      
      return {
        menteeTags: menteeTags,
        mentorTags: testCase.mentorTags,
        overlap: overlap,
        overlapPercentage: `${(overlap * 100).toFixed(1)}%`,
        tagScore: tagScore.toFixed(1),
        expected: testCase.expected
      };
    });

    return NextResponse.json({
      message: "Tag scoring test",
      menteeTags: menteeTags,
      testCases: results,
      explanation: "Tag score = overlap percentage × 30 (30% weight in final formula)"
    });

  } catch (error) {
    console.error("Error in tag-scoring-test:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
