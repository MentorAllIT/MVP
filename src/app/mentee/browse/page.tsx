"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./browse.module.css";
import HamburgerMenu from "../../components/HamburgerMenu";
import SimpleLock from "../../components/SimpleLock";


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
    if (loading) return "Finding your best matches…";
    if (error) return "We hit a snag while loading your matches.";
    if (!mentors.length) return "No matches yet — check back soon!";
    return `We found ${mentors.length} mentor${mentors.length > 1 ? "s" : ""} for you`;
  }, [loading, error, mentors.length]);

  return <SimpleLock />;
}
