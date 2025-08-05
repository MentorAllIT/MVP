"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./signin.module.css";

export default function SignInPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      email: fd.get("email") as string,
      password: fd.get("password") as string,
    };

    try {
      const res = await fetch("/api/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();              // ← parse once

      if (!res.ok) throw new Error(data.error || "Invalid credentials");

      /* route based on profile existence */
      if (data.profile) {
        router.replace("/dashboard");
      } else {
        router.replace(`/profile-setup?uid=${data.uid}&role=${data.role}`);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome Back</h1>
        <p className={styles.subtitle}>Sign in to your MentorAll mentee account</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <label className={styles.label}>
            Email
            <input name="email" type="email" required className={styles.input} />
          </label>

          <label className={styles.label}>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className={styles.input}
            />
          </label>

          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? "Signing In…" : "Sign In"}
          </button>

          {error && <p className={styles.error}>{error}</p>}
        </form>
      </div>
    </div>
  );
}
