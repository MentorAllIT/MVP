"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  const router = useRouter();

  if (role !== "mentor" && role !== "mentee") {
    return <p className={styles.error}>Unknown signup role.</p>;
  }

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setFieldErrs({});
    setFormErr(null);

    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

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

  const roleTitle = role === "mentor" ? "Mentor" : "Mentee";
  const roleSubtitle = role === "mentor" 
    ? "Share your expertise and guide mentees on their journey" 
    : "Connect with mentors who can help you grow";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>
            Mentor<span className={styles.aiHighlight}>AI</span>l
          </Link>
          <nav className={styles.nav}>
            <Link href="/" className={styles.navLink}>Home</Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.textSection}>
              <h1 className={styles.welcomeTitle}>{roleTitle}</h1>
              <p className={styles.welcomeSubtitle}>{roleSubtitle}</p>
              
              <div className={styles.features}>
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>
                    {role === "mentor" ? "🎯" : "🚀"}
                  </div>
                  <span>
                    {role === "mentor" 
                      ? "Share your knowledge and experience" 
                      : "Get personalized guidance and support"
                    }
                  </span>
                </div>
                
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>
                    {role === "mentor" ? "💬" : "📚"}
                  </div>
                  <span>
                    {role === "mentor" 
                      ? "Make a meaningful impact on mentee's professional journey" 
                      : "Learn from industry experts and professionals"
                    }
                  </span>
                </div>
                
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>
                    {role === "mentor" ? "🌟" : "🎯"}
                  </div>
                  <span>
                    {role === "mentor" 
                      ? "Build your mentoring skills and network" 
                      : "Achieve your goals faster with MentorAll"
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formCard}>
                <h2 className={styles.formTitle}>Create Your Account</h2>
                <p className={styles.formSubtitle}>Join MentorAll and start your journey</p>

                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Full Name</span>
                      <input
                        name="name"
                        className={`${styles.input} ${
                          fieldErrs.name ? styles.inputError : ""
                        }`}
                        disabled={submitting}
                        placeholder="Enter your full name"
                      />
                      {fieldErrs.name && (
                        <span className={styles.fieldError}>{fieldErrs.name}</span>
                      )}
                    </label>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Email Address</span>
                      <input
                        name="email"
                        type="email"
                        className={`${styles.input} ${
                          fieldErrs.email ? styles.inputError : ""
                        }`}
                        disabled={submitting}
                        placeholder="Enter your email address"
                      />
                      {fieldErrs.email && (
                        <span className={styles.fieldError}>{fieldErrs.email}</span>
                      )}
                    </label>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Password</span>
                      <input
                        name="password"
                        type="password"
                        className={`${styles.input} ${
                          fieldErrs.password ? styles.inputError : ""
                        }`}
                        disabled={submitting}
                        placeholder="Create a strong password"
                      />
                      {fieldErrs.password && (
                        <span className={styles.fieldError}>{fieldErrs.password}</span>
                      )}
                    </label>
                  </div>

                  <button type="submit" disabled={submitting} className={styles.button}>
                    {submitting ? (
                      <span className={styles.buttonContent}>
                        <span className={styles.spinner}></span>
                        Creating Account...
                      </span>
                    ) : (
                      "Create Account"
                    )}
                  </button>

                  {success && !formErr && (
                    <div className={styles.success}>Account created successfully!</div>
                  )}
                  {formErr && <div className={styles.error}>{formErr}</div>}
                </form>

                <div className={styles.formFooter}>
                  <p className={styles.formFooterText}>
                    Already have an account?{" "}
                    <Link href="/signin" className={styles.formFooterLink}>
                      Sign In Here
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
