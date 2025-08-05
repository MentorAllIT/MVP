"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./metaSetup.module.css";

export default function MetaSetup() {
  const params = useSearchParams();
  const router = useRouter();

  const uid  = params.get("uid");
  const role = params.get("role");

  if (!uid || !role) {
    return <p style={{ padding: "2rem" }}>Missing information. Please sign in again.</p>;
  }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    fd.append("uid", uid);
    fd.append("role", role);

    const res = await fetch("/api/meta", { method: "POST", body: fd });

    setSubmitting(false);

    if (res.ok) router.replace("/dashboard");
    else {
      const { error } = await res.json().catch(() => ({}));
      setError(error ?? "Could not save");
    }
  }

  // Role-specific form
  const menteeFields = (
    <>
      <label className={styles.label}>
        Your main goal
        <textarea name="goal" required className={styles.textarea} />
      </label>

      <label className={styles.label}>
        Current challenges
        <textarea name="challenges" required className={styles.textarea} />
      </label>

      <label className={styles.label}>
        Help you’re looking for
        <textarea name="help" required className={styles.textarea} />
      </label>
    </>
  );

  const mentorFields = (
    <>
      <label className={styles.label}>
        Industry
        <input name="industry" required className={styles.input} />
      </label>

      <label className={styles.label}>
        Years of experience
        <input name="years" type="number" min={0} required className={styles.input} />
      </label>

      <label className={styles.label}>
        Calendly URL
        <input name="calendly" type="url" required className={styles.input} />
      </label>
    </>
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {role === "mentee" ? "A bit more about your journey" : "Share your mentoring background"}
        </h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          {role === "mentee" ? menteeFields : mentorFields}

          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? "Saving…" : "Finish"}
          </button>

          {error && <p className={styles.error}>{error}</p>}
        </form>
      </div>
    </div>
  );
}