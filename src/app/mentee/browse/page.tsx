"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./browse.module.css";
import HamburgerMenu from "../../components/HamburgerMenu";


type Mentor = {
  userId: string;
  rankedUpdatedAt?: string | null;

  // Users
  name?: string | null;

  // Profiles
  bio?: string | null;
  linkedIn?: string | null;

  // MentorMeta
  industry?: string | null;
  yearExp?: number | null;
  skill?: string | string[] | null;
  location?: string | null;
  role?: string | null;
  company?: string | null;
  schoolName?: string | null;
  fieldOfStudy?: string | null;
  tags?: string[];
  metaUpdatedAt?: string | null;

  // Additional mentor fields
  currentRole?: string | null;
  seniorityLevel?: string | null;
  previousRoles?: string | null;
  mentoringStyle?: string | null;
  culturalBackground?: string | null;
  availability?: string | null;

  // Matching scores
  score?: number | null;
  
  // Enhanced Scoring Data
  preferenceScore?: number | null;
  tagScore?: number | null;
  breakdown?: string | null;
};

function splitSkills(skill?: string | string[] | null): string[] {
  if (!skill) return [];
  if (Array.isArray(skill)) return skill.filter(Boolean).map(String).slice(0, 12);
  return skill
    .split(/[,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

const timeAgo = (iso?: string | null) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

function useMentorMatches() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/mentee/mentor-match", { cache: "no-store" });
        if (res.status === 401) return router.replace("/signin");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load matches");
        }
        const data = (await res.json()) as { mentors: Mentor[] };
        if (!cancelled) setMentors(Array.isArray(data.mentors) ? data.mentors : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { loading, mentors, error };
}

export default function BrowseMentorsPage() {
  const { loading, mentors, error } = useMentorMatches();

  const subtitle = useMemo(() => {
    if (loading) return "Searching for your perfect mentor matches…";
    if (error) return "We hit a snag while loading your matches.";
    if (!mentors.length) return "No matches yet — check back soon!";
    return `We found ${mentors.length} mentor${mentors.length > 1 ? "s" : ""} for you`;
  }, [loading, error, mentors.length]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Dynamic and Best Match</h1>
          <HamburgerMenu theme="light" />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h2 className={styles.subtitle}>{subtitle}</h2>
          </section>

          {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading mentor profiles...</p>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <h3>Oops! Something went wrong</h3>
              <p>{error}</p>
              <button 
                className={styles.retryButton}
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && mentors.length > 0 && (
            <div className={styles.mentorsContainer}>
              {mentors.map((mentor) => (
                <div key={mentor.userId} className={styles.mentorCardLarge}>
                  <div className={styles.mentorHeader}>
                    <div className={styles.mentorTitleSection}>
                      <h2 className={styles.mentorName}>
                        {mentor.name || "Anonymous Mentor"}
                      </h2>
                      {mentor.score && (
                        <div className={styles.matchScore}>
                          {mentor.score}% match
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.mentorContent}>
                    <div className={styles.mentorMainInfo}>
                      <div className={styles.mentorInfoGrid}>
                        {mentor.industry && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Industry:</span>
                            <span className={styles.value}>{mentor.industry}</span>
                          </div>
                        )}
                        
                        {mentor.currentRole && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Current Role:</span>
                            <span className={styles.value}>{mentor.currentRole}</span>
                          </div>
                        )}
                        
                        {mentor.role && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Previous Role:</span>
                            <span className={styles.value}>{mentor.role}</span>
                          </div>
                        )}
                        
                        {mentor.seniorityLevel && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Seniority Level:</span>
                            <span className={styles.value}>{mentor.seniorityLevel}</span>
                          </div>
                        )}
                        
                        {mentor.yearExp && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Years of Experience:</span>
                            <span className={styles.value}>{mentor.yearExp} years</span>
                          </div>
                        )}
                        
                        {mentor.company && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Company:</span>
                            <span className={styles.value}>{mentor.company}</span>
                          </div>
                        )}
                        
                        {mentor.location && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Location:</span>
                            <span className={styles.value}>{mentor.location}</span>
                          </div>
                        )}

                        {mentor.schoolName && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Education:</span>
                            <span className={styles.value}>{mentor.schoolName}</span>
                          </div>
                        )}

                        {mentor.fieldOfStudy && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Field of Study:</span>
                            <span className={styles.value}>{mentor.fieldOfStudy}</span>
                          </div>
                        )}

                        {mentor.mentoringStyle && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Mentoring Style:</span>
                            <span className={styles.value}>{mentor.mentoringStyle}</span>
                          </div>
                        )}

                        {mentor.culturalBackground && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Cultural Background:</span>
                            <span className={styles.value}>{mentor.culturalBackground}</span>
                          </div>
                        )}

                        {mentor.availability && (
                          <div className={styles.infoItem}>
                            <span className={styles.label}>Availability:</span>
                            <span className={styles.value}>{mentor.availability}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {mentor.bio && (
                      <div className={styles.mentorBio}>
                        <h3 className={styles.bioTitle}>About</h3>
                        <p className={styles.bioText}>{mentor.bio}</p>
                      </div>
                    )}

                    {mentor.previousRoles && (
                      <div className={styles.mentorPreviousRoles}>
                        <h3 className={styles.previousRolesTitle}>Previous Roles</h3>
                        <div className={styles.previousRolesContent}>
                          <p className={styles.previousRolesText}>{mentor.previousRoles}</p>
                        </div>
                      </div>
                    )}

                    {mentor.skill && (
                      <div className={styles.mentorSkills}>
                        <h3 className={styles.skillsTitle}>Skills & Expertise</h3>
                        <div className={styles.skillsContent}>
                          {Array.isArray(mentor.skill) ? (
                            <div className={styles.skillsList}>
                              {mentor.skill.map((skill, index) => (
                                <span key={index} className={styles.skillItem}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className={styles.skillsText}>{mentor.skill}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {mentor.tags && mentor.tags.length > 0 && (
                      <div className={styles.mentorTags}>
                        <h3 className={styles.tagsTitle}>Specializations</h3>
                        <div className={styles.tagsList}>
                          {mentor.tags.map((tag, index) => (
                            <span key={index} className={styles.tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={styles.mentorActions}>
                      {mentor.linkedIn && (
                        <a 
                          href={mentor.linkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkedinButton}
                        >
                          Connect on LinkedIn
                        </a>
                      )}
                    </div>

                    {mentor.breakdown && (
                      <div className={styles.matchBreakdown}>
                        <h3 className={styles.breakdownTitle}>Why This Match?</h3>
                        <div className={styles.breakdownContent}>
                          <p>{mentor.breakdown}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && mentors.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <h3>No mentors found</h3>
              <p>We couldn't find any mentors that match your preferences right now.</p>
              <p>Try updating your preferences or check back later!</p>
              <Link href="/mentee-preferences" className={styles.updatePreferencesButton}>
                Update Preferences
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
