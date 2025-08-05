"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import zxcvbn from "zxcvbn";
import styles from "./signup.module.css";

// Validation
const formSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }),
  email: z.string().trim().email({ message: "Enter a valid e-mail address" }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters",
  }),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof formSchema>, string>>;

export default function SignUpPage() {
  const { role } = useParams<{ role: string }>() ?? {};
  const router   = useRouter();

  if (role !== "mentor" && role !== "mentee") {
    return <p className={styles.error}>Unknown signup role.</p>;
  }

  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [formErr,    setFormErr]    = useState<string | null>(null);
  const [fieldErrs,  setFieldErrs]  = useState<FieldErrors>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setFieldErrs({});
    setFormErr(null);

    const form = e.currentTarget;
    const raw  = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    // zod checks
    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const errs: FieldErrors = {};
      parsed.error.issues.forEach((i) => {
        const f = i.path[0] as keyof FieldErrors;
        errs[f] = i.message;
      });
      setFieldErrs(errs);
      return;
    }

    // password strength
    const { score, feedback } = zxcvbn(raw.password);
    if (score < 3) {
      setFieldErrs({
        password:
          feedback.warning ||
          "Password is too weak – add more words, numbers or symbols.",
      });
      return;
    }

    // Submit
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: raw.name.trim(),
          email: raw.email.trim().toLowerCase(),
          password: raw.password,
          role,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setFieldErrs({ email: data.error });
        return;
      }
      if (!res.ok) {
        setFormErr(data.error ?? "Unexpected error – please try again.");
        return;
      }

      setSuccess(true);
      router.replace(`/profile-setup?uid=${data.id}&role=${role}`);
    } catch (err) {
      console.error(err);
      setFormErr("Network error – check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Get Started</h1>
        <p className={styles.subtitle}>Create your free MentorAll account</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <label className={styles.label}>
            Full Name
            <input
              name="name"
              className={`${styles.input} ${
                fieldErrs.name ? styles.inputError : ""
              }`}
              disabled={submitting}
            />
            {fieldErrs.name && (
              <span className={styles.fieldError}>{fieldErrs.name}</span>
            )}
          </label>

          <label className={styles.label}>
            Email
            <input
              name="email"
              className={`${styles.input} ${
                fieldErrs.email ? styles.inputError : ""
              }`}
              disabled={submitting}
            />
            {fieldErrs.email && (
              <span className={styles.fieldError}>{fieldErrs.email}</span>
            )}
          </label>

          <label className={styles.label}>
            Password
            <input
              name="password"
              type="password"
              className={`${styles.input} ${
                fieldErrs.password ? styles.inputError : ""
              }`}
              disabled={submitting}
            />
            {fieldErrs.password && (
              <span className={styles.fieldError}>{fieldErrs.password}</span>
            )}
          </label>

          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? "Creating Account…" : "Create Account"}
          </button>

          {success && !formErr && (
            <p className={styles.success}>Account created!</p>
          )}
          {formErr && <p className={styles.error}>{formErr}</p>}
        </form>
      </div>
    </div>
  );
}
