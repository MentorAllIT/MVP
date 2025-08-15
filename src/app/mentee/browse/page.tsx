"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./browse.module.css";

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
  calendly?: string | null;
  skill?: string | string[] | null;
  location?: string | null;
  role?: string | null;
  company?: string | null;
  schoolName?: string | null;
  fieldOfStudy?: string | null;
  tags?: string[];
  metaUpdatedAt?: string | null;

  // Matching scores
  score?: number | null;
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

  // Get only the highest scoring mentor
  const topMentor = useMemo(() => {
    if (!mentors.length) return null;
    return mentors.reduce((top, current) => 
      (current.preferenceScore || 0) > (top.preferenceScore || 0) ? current : top
    );
  }, [mentors]);

  const subtitle = useMemo(() => {
    if (loading) return "Finding your best match…";
    if (error) return "We hit a snag while loading your match.";
    if (!topMentor) return "No matches yet — check back soon!";
    return `We found your best mentor match with ${topMentor.preferenceScore || 0}% preference alignment!`;
  }, [loading, error, topMentor]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>MentorAll</Link>
          <nav className={styles.nav}>
            <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
            <Link href="/profile" className={styles.navLink}>Profile</Link>
            <Link href="/settings" className={styles.navLink}>Settings</Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h1 className={styles.title}>Browse Mentors</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </section>

          {loading && (
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${styles.card} ${styles.skeleton}`} />
              ))}
            </div>
          )}

          {!loading && error && <div className={styles.errorBox}>{error}</div>}

          {!loading && !error && mentors.length === 0 && (
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>🔍</div>
              <h3>No matches yet</h3>
              <p>Complete your profile to start seeing mentors.</p>
              <Link href="/profile" className={styles.ctaButton}>Edit Profile</Link>
            </div>
          )}

          {!loading && !error && topMentor && (
            <div className={styles.grid}>
              <article className={styles.card} key={topMentor.userId}>
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>
                    {(topMentor.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.headings}>
                    <div className={styles.titleRow}>
                      <h3 className={styles.cardTitle}>{topMentor.name || "Unnamed Mentor"}</h3>
                      {typeof topMentor.yearExp === "number" && (
                        <span className={styles.expBadge}>{topMentor.yearExp} yrs exp</span>
                      )}
                      {/* Show preference score prominently */}
                      {typeof topMentor.preferenceScore === "number" && (
                        <span className={styles.scoreBadge}>
                          {topMentor.preferenceScore}% Match
                        </span>
                      )}
                    </div>
                    <p className={styles.cardMeta}>
                      {topMentor.role || "Mentor"}{topMentor.company ? ` @ ${topMentor.company}` : ""}
                    </p>
                    {timeAgo(topMentor.rankedUpdatedAt || topMentor.metaUpdatedAt) && (
                      <span className={styles.updatedAt}>
                        Updated {timeAgo(topMentor.rankedUpdatedAt || topMentor.metaUpdatedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {topMentor.bio && <p className={styles.bio}>{topMentor.bio}</p>}

                {/* Quick facts */}
                <div className={styles.chips}>
                  {topMentor.industry && <span className={styles.chip}>{topMentor.industry}</span>}
                  {topMentor.location && (
                    <span className={`${styles.chip} ${styles.locationChip} ${styles.bigChip}`}>
                      📍 {topMentor.location}
                    </span>
                  )}
                  {[topMentor.fieldOfStudy, topMentor.schoolName].filter(Boolean).join(" @ ") && (
                    <span className={`${styles.chip} ${styles.bigChip}`}>
                      {[topMentor.fieldOfStudy, topMentor.schoolName].filter(Boolean).join(" @ ")}
                    </span>
                  )}
                </div>

                {/* Focus areas / Tags */}
                {topMentor.tags && topMentor.tags.length > 0 && (
                  <div className={styles.tagSection}>
                    <h4 className={styles.sectionTitle}>Focus areas</h4>
                    <div className={styles.tagList}>
                      {topMentor.tags.slice(0, 12).map((t, i) => (
                        <span className={styles.tagPill} key={i}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {splitSkills(topMentor.skill).length > 0 && (
                  <div className={styles.skillSection}>
                    <h4 className={styles.sectionTitle}>Skills</h4>
                    <div className={styles.skills}>
                      {splitSkills(topMentor.skill).map((s, i) => (
                        <span key={i} className={styles.skillPill}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.actions}>
                  {topMentor.linkedIn && (
                    <a className={styles.secondaryButton} href={topMentor.linkedIn} target="_blank" rel="noopener noreferrer">
                      View LinkedIn
                    </a>
                  )}
                  {topMentor.calendly ? (
                    <a className={styles.primaryButton} href={topMentor.calendly} target="_blank" rel="noopener noreferrer">
                      Book on Calendly
                    </a>
                  ) : (
                    <button className={styles.primaryButton} disabled>
                      Calendly unavailable
                    </button>
                  )}
                </div>
              </article>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
