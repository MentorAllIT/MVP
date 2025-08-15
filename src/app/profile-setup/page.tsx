"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { z } from "zod";
import styles from "./profileSetup.module.css";

// Helpers
const formSchema = z.object({
  bio: z.string().trim().min(10, { message: "Tell us a bit more (≥ 10 chars)" }),
  linkedin: z
    .string()
    .trim()
    .url({ message: "Enter a valid URL" })
    .refine(
      (v) => /^https?:\/\/(www\.)?linkedin\.com\//i.test(v),
      { message: "URL must start with linkedin.com" }
    ),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

// Role-based content
function getBioContent(role: string | null) {
  if (role === "mentor") {
    return {
      placeholder:
        'E.g. “Senior backend engineer @ Google with 8 yrs experience.\ Expert in distributed systems & Golang. Love helping juniors level-up.”',
      tips: [
        "Current job title and company",
        "Years of industry experience",
        "Key technologies / domains you excel in",
        "Specific areas you can mentor on (e.g. interviews, system design)",
        "Any past mentoring or leadership experience",
        "Approach or philosophy (hands-on code reviews, pair programming, etc.)",
      ],
    };
  }
  // default = mentee
  return {
    placeholder:
      'E.g. “Final-year CS student at UBC, international from India. \
Interested in ML & backend engineering. Graduating 2025.”',
    tips: [
      "Degree or program you’re studying / completed",
      "Your university, bootcamp or college",
      "International-student status",
      "Expected graduation year",
      "Key projects or internships",
      "Fields you’re eager to explore next",
    ],
  };
}

export default function ProfileSetup() {
  const params = useSearchParams();
  const router = useRouter();
  const uid    = params.get("uid");
  const role   = params.get("role");

  const { placeholder, tips } = getBioContent(role);

  const subtitle =
  role === "mentor"
    ? "We’ll show this to potential mentees"
    : "We’ll use this to match you with mentors";

  const [bio,       setBio]       = useState("");
  const [linkedin,  setLinkedin]  = useState("");
  const [showHelp,  setShowHelp]  = useState(false);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [formErr,   setFormErr]   = useState<string | null>(null);
  const [submitting,setSubmitting]= useState(false);
  const [loading,   setLoading]   = useState(true);

  // Load existing profile data when component mounts
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!uid) return;
      
      try {
        // Try to fetch existing profile data
        const res = await fetch(`/api/profile?uid=${uid}`);
        if (res.ok) {
          const profileData = await res.json();
          if (profileData.bio) setBio(profileData.bio);
          if (profileData.linkedin) setLinkedin(profileData.linkedin);
        }
      } catch (error) {
        console.log("No existing profile found or error loading profile");
      } finally {
        setLoading(false);
      }
    };

    loadExistingProfile();
  }, [uid]);

  if (!uid) {
    return (
      <p style={{ padding: "2rem" }}>
        Missing user ID. Please sign up again.
      </p>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.wrapper}>
          <div className={styles.loading}>Loading profile...</div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setFieldErrs({});
    setFormErr(null);

    const parsed = formSchema.safeParse({ bio, linkedin });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      parsed.error.issues.forEach((i) => {
        const f = i.path[0] as keyof FieldErrors;
        errs[f] = i.message;
      });
      setFieldErrs(errs);
      return;
    }

    if (!uid) {
      setFormErr("Missing user id. Please sign in again.");
      return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append("uid", uid);
    fd.append("bio", bio.trim());
    fd.append("linkedin", linkedin.trim());

    const res = await fetch("/api/profile", { method: "POST", body: fd });
    setSubmitting(false);

    if (res.ok) {
      router.replace(`/meta-setup?uid=${uid}&role=${role}`);
    } else {
      const { error } = await res.json().catch(() => ({}));
      setFormErr(error ?? "Unable to save profile");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h1 className={styles.title}>Tell us about you</h1>
          <p className={styles.subtitle}>
            {subtitle}
          </p>
        </div>
        
        <div className={styles.card}>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.label}>
            <span className={styles.labelText}>Short Bio</span>
            <textarea
              name="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`${styles.textarea} ${
                fieldErrs.bio ? styles.inputError : ""
              }`}
              placeholder={placeholder}
            />
            {fieldErrs.bio && (
              <span className={styles.fieldError}>{fieldErrs.bio}</span>
            )}
            <button
              type="button"
              className={styles.helpToggle}
              onClick={() => setShowHelp((v) => !v)}
            >
              {showHelp ? "Hide ideas" : "Need ideas?"}
            </button>
            {showHelp && (
              <ul className={styles.helpList}>
                {tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </label>

          <label className={styles.label}>
            <span className={styles.labelText}>LinkedIn URL</span>
            <input
              name="linkedin"
              type="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className={`${styles.input} ${
                fieldErrs.linkedin ? styles.inputError : ""
              }`}
              placeholder="https://www.linkedin.com/…"
            />
            {fieldErrs.linkedin && (
              <span className={styles.fieldError}>{fieldErrs.linkedin}</span>
            )}
          </label>

          <button
            type="submit"
            disabled={submitting}
            className={styles.button}
          >
            {submitting ? "Saving…" : "Save & Continue"}
          </button>

          {formErr && <p className={styles.error}>{formErr}</p>}
        </form>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: role === "mentee" ? "33%" : "50%" }}
            />
          </div>
          <span className={styles.progressText}>
            {role === "mentee" ? "Step 1 of 3" : "Step 1 of 2"}
          </span>
        </div>
      </div>
    </div>
  );
}
