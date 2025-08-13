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
    if (loading) return "Finding your best matches…";
    if (error) return "We hit a snag while loading your matches.";
    if (!mentors.length) return "No matches yet — check back soon!";
    return `We found ${mentors.length} mentor${mentors.length > 1 ? "s" : ""} for you`;
  }, [loading, error, mentors.length]);

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

          {!loading && !error && mentors.length > 0 && (
            <div className={styles.grid}>
              {mentors.map((m) => {
                const skills = splitSkills(m.skill);
                const updated = timeAgo(m.rankedUpdatedAt || m.metaUpdatedAt) || undefined;
                const education = [m.fieldOfStudy, m.schoolName].filter(Boolean).join(" @ ");

                return (
                  <article className={styles.card} key={m.userId}>
                    <div className={styles.cardTop}>
                      <div className={styles.avatar}>
                        {(m.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.headings}>
                        <div className={styles.titleRow}>
                          <h3 className={styles.cardTitle}>{m.name || "Unnamed Mentor"}</h3>
                          {typeof m.yearExp === "number" && (
                            <span className={styles.expBadge}>{m.yearExp} yrs exp</span>
                          )}
                        </div>
                        <p className={styles.cardMeta}>
                          {m.role || "Mentor"}{m.company ? ` @ ${m.company}` : ""}
                        </p>
                        {updated && <span className={styles.updatedAt}>Updated {updated}</span>}
                      </div>
                    </div>

                    {m.bio && <p className={styles.bio}>{m.bio}</p>}

                    {/* Quick facts */}
                    <div className={styles.chips}>
                      {m.industry && <span className={styles.chip}>{m.industry}</span>}
                      {m.location && (
                        <span className={`${styles.chip} ${styles.locationChip} ${styles.bigChip}`}>
                          📍 {m.location}
                        </span>
                      )}
                      {education && (
                        <span className={`${styles.chip} ${styles.bigChip}`}>{education}</span>
                      )}
                    </div>

                    {/* Focus areas / Tags */}
                    {m.tags && m.tags.length > 0 && (
                      <div className={styles.tagSection}>
                        <h4 className={styles.sectionTitle}>Focus areas</h4>
                        <div className={styles.tagList}>
                          {m.tags.slice(0, 12).map((t, i) => (
                            <span className={styles.tagPill} key={i}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skills */}
                    {skills.length > 0 && (
                      <div className={styles.skillSection}>
                        <h4 className={styles.sectionTitle}>Skills</h4>
                        <div className={styles.skills}>
                          {skills.map((s, i) => (
                            <span key={i} className={styles.skillPill}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={styles.actions}>
                      {m.linkedIn && (
                        <a className={styles.secondaryButton} href={m.linkedIn} target="_blank" rel="noopener noreferrer">
                          View LinkedIn
                        </a>
                      )}
                      <Link className={styles.primaryButton} href={`/booking?mentorId=${m.userId}&mentorName=${encodeURIComponent(m.name || 'Mentor')}`}>
                        Book session
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
