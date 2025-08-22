"use client";

import { useRef, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import zxcvbn from "zxcvbn";
import styles from "./signup.module.css";

// Step validations
const step1Schema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }),
  email: z.string().trim().email({ message: "Enter a valid e-mail address" }),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6}$/, { message: "Enter a 6-character code" }),
});

const step2Schema = z.object({
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

type FieldErrors = Partial<Record<"name" | "email" | "code" | "password", string>>;

export default function SignUpPage() {
  const { role } = useParams<{ role: string }>() ?? {};
  const router = useRouter();

  if (role !== "mentor" && role !== "mentee") {
    return <p className={styles.error}>Unknown signup role.</p>;
  }

  const formRef = useRef<HTMLFormElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [verified, setVerified]     = useState(false);

  const [success, setSuccess]     = useState(false);
  const [formErr, setFormErr]     = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});

  // Lock values after verify (disabled inputs don't submit)
  const [lockedName, setLockedName]   = useState<string | null>(null);
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);
  const [approvedCode, setApprovedCode] = useState<string>("");

  // Session modal state - check already signed in
  const [session, setSession] = useState<{ email: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/check", { cache: "no-store" });
        if (!cancelled && r.ok) {
          const d = await r.json();
          setSession({ email: d.email });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSignout() {
    await fetch("/api/auth/signout", { method: "POST" });
    setSession(null);
    router.refresh();
  }

  async function handleVerify() {
    if (verifying || submitting) return;
    setFieldErrs({});
    setFormErr(null);

    const form = formRef.current;
    if (!form) return;

    const raw = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const parsed = step1Schema.safeParse(raw);
    if (!parsed.success) {
      const errs: FieldErrors = {};
      parsed.error.issues.forEach((i) => {
        const f = i.path[0] as keyof FieldErrors;
        errs[f] = i.message;
      });
      setFieldErrs(errs);
      return;
    }

    const name  = raw.name.trim();
    const email = raw.email.trim().toLowerCase();
    const code  = raw.code.trim().toUpperCase();

    setVerifying(true);
    try {
      const res = await fetch("/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFieldErrs({ code: data.error ?? "Invalid code for this e-mail." });
        return;
      }

      // Success: freeze name/email, hide code, show password
      setVerified(true);
      setLockedName(name);
      setLockedEmail(email);
      setApprovedCode(code);
    } catch (err) {
      console.error(err);
      setFormErr("Network error – check your connection.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setFieldErrs({});
    setFormErr(null);

    if (!verified) {
      setFormErr("Please verify your e-mail with the 6-character code first.");
      return;
    }

    const form = formRef.current!;
    const raw = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    // validate password
    const parsed = step2Schema.safeParse({ password: raw.password ?? "" });
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
          name: lockedName,
          email: lockedEmail,
          password: raw.password,
          role,
          code: approvedCode,
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
      router.replace(`/profile-setup?uid=${data.uid}&role=${role}`);
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
          <Link href="/" className={styles.logoContainer}>
            <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
          </Link>
        </div>
      </header>

      {session && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>You're already signed in</h3>
            <p className={styles.modalBody}>
              Signed in as <strong>{session.email}</strong>.
            </p>
            <div className={styles.modalButtons}>
              <button
                className={styles.button}
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </button>
              <button
                className={styles.buttonSecondary}
                onClick={handleSignout}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.textSection}>
              <h1 className={styles.welcomeTitle}>{roleTitle}</h1>
              <p className={styles.welcomeSubtitle}>{roleSubtitle}</p>
              
              <div className={styles.features}>
                <div className={styles.featureCard}>
                  <div className={styles.featureCardInner}>
                    <div className={styles.featureCardFront}>
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
                    <div className={styles.featureCardBack}>
                      <div className={styles.featureIcon}>
                        {role === "mentor" ? "💡" : "🌟"}
                      </div>
                      <span>
                        {role === "mentor" 
                          ? "Help others grow while building your leadership skills" 
                          : "Accelerate your career with expert mentorship"
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.featureCard}>
                  <div className={styles.featureCardInner}>
                    <div className={styles.featureCardFront}>
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
                    <div className={styles.featureCardBack}>
                      <div className={styles.featureIcon}>
                        {role === "mentor" ? "🤝" : "🎓"}
                      </div>
                      <span>
                        {role === "mentor" 
                          ? "Build lasting relationships and see your mentees succeed" 
                          : "Gain insights from real-world experience and best practices"
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.featureCard}>
                  <div className={styles.featureCardInner}>
                    <div className={styles.featureCardFront}>
                      <div className={styles.featureIcon}>
                        {role === "mentor" ? "🌟" : "🎯"}
                      </div>
                      <span>
                        {role === "mentor" 
                          ? "Build your mentoring skills and network" 
                          : "Achieve your goals faster with expert guidance"
                        }
                      </span>
                    </div>
                    <div className={styles.featureCardBack}>
                      <div className={styles.featureIcon}>
                        {role === "mentor" ? "📈" : "⚡"}
                      </div>
                      <span>
                        {role === "mentor" 
                          ? "Expand your professional network and personal brand" 
                          : "Fast-track your success with personalized action plans"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formCard}>
                <h2 className={styles.formTitle}>Create Your Account</h2>
                <p className={styles.formSubtitle}>Join MentorAll and start your journey</p>

                <form ref={formRef} onSubmit={handleSubmit} className={styles.form} noValidate>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Full Name</span>
                      <input
                        name="name"
                        className={`${styles.input} ${fieldErrs.name ? styles.inputError : ""}`}
                        disabled={submitting || verified}
                        autoComplete="name"
                        placeholder="Enter your full name"
                      />
                      {fieldErrs.name && <span className={styles.fieldError}>{fieldErrs.name}</span>}
                    </label>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Email Address</span>
                      <input
                        name="email"
                        type="email"
                        className={`${styles.input} ${fieldErrs.email ? styles.inputError : ""}`}
                        disabled={submitting || verified}
                        autoComplete="email"
                        placeholder="Enter your email address"
                      />
                      {fieldErrs.email && <span className={styles.fieldError}>{fieldErrs.email}</span>}
                    </label>
                  </div>

                  <div className={styles.inputGroup}>
                    {!verified && (
                      <label className={styles.label}>
                        Approval Code
                        <input
                          name="code"
                          pattern="[A-Za-z0-9]{6}"
                          placeholder="6-character code"
                          className={`${styles.input} ${fieldErrs.code ? styles.inputError : ""}`}
                          disabled={submitting || verifying}
                          autoComplete="one-time-code"
                          autoCapitalize="characters"
                        />
                        {fieldErrs.code && <span className={styles.fieldError}>{fieldErrs.code}</span>}
                      </label>
                    )}
                  </div>

                  {verified && (
                    <label className={styles.label}>
                        Password
                        <input
                          name="password"
                          type="password"
                          className={`${styles.input} ${fieldErrs.password ? styles.inputError : ""}`}
                          disabled={submitting}
                          autoComplete="new-password"
                        />
                        {fieldErrs.password && (
                          <span className={styles.fieldError}>{fieldErrs.password}</span>
                        )}
                      </label>
                    )}

                    {!verified ? (
                      <button
                        type="button"
                        onClick={handleVerify}
                        disabled={verifying}
                        className={styles.button}
                      >
                        {verifying ? "Verifying…" : "Verify Code"}
                      </button>
                    ) : (
                      <button type="submit" disabled={submitting} className={styles.button}>
                        {submitting ? "Creating Account…" : "Create Account"}
                      </button>
                    )}

                  {verified && !formErr && !success && (
                    <p className={styles.success}>Email approved — set your password.</p>
                  )}
                  {success && !formErr && <p className={styles.success}>Account created!</p>}
                  {formErr && <div className={styles.error}>{formErr}</div>}
                </form>

                <div className={styles.formFooter}>
                  <p className={styles.formFooterText}>
                    Already have an account?{" "}
                    <Link href="/signin" className={styles.formFooterLink}>
                      Sign In Here
                    </Link> or {" "}
                    <Link href={role === 'mentor' ? '/mentee/signup' : '/mentor/signup'} className={styles.formFooterLink}>
                      Become a {role === 'mentor' ? 'Mentee' : 'Mentor'}
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
