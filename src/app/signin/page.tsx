"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import styles from "./signin.module.css";

export default function SignInPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");


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

  // This can be removed since we're no longer auto-redirecting from forgot password
  // Users will manually navigate here using the "Go to Sign In" button

  async function handleSignout() {
    await fetch("/api/auth/signout", { method: "POST" });
    setSession(null);
    router.refresh();
  }



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

      const data = await res.json();

      if (!res.ok) {
        // Handle specific error cases with user-friendly messages
        if (data.error === "Invalid credentials") {
          throw new Error("Email and password do not match");
        } else if (data.error === "Missing credentials") {
          throw new Error("Please enter both email and password");
        } else if (data.error && data.error.includes("not configured")) {
          throw new Error("System temporarily unavailable. Please try again later.");
        } else {
          throw new Error(data.error || "Email and password do not match");
        }
      }

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
              <h1 className={styles.welcomeTitle}>Welcome Back</h1>
              <p className={styles.welcomeSubtitle}>
                Sign in to continue your mentoring journey and connect with amazing people
              </p>
              <div className={styles.features}>
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>🎯</div>
                  <span>Access your personalized dashboard</span>
                </div>
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>💬</div>
                  <span>Connect with your mentors</span>
                </div>
                <div className={styles.feature}>
                  <div className={styles.featureIcon}>📈</div>
                  <span>Track your progress</span>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formCard}>
                <h2 className={styles.formTitle}>Sign In</h2>
                <p className={styles.formSubtitle}>Enter your credentials to continue</p>

                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Email Address</span>
                      <input 
                        name="email" 
                        type="email" 
                        required 
                        className={styles.input} 
                        placeholder="Enter your email"
                      />
                    </label>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Password</span>
                      <input
                        name="password"
                        type="password"
                        required
                        minLength={8}
                        className={styles.input}
                        disabled={submitting}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                      />
                    </label>
                    <div className={styles.forgotPasswordContainer}>
                      <Link href="/forgot-password" className={styles.forgotPasswordLink}>
                        Forgot Password?
                      </Link>
                    </div>
                  </div>

                  <button type="submit" disabled={submitting} className={styles.button}>
                    {submitting ? (
                      <span className={styles.buttonContent}>
                        <span className={styles.spinner}></span>
                        Signing In...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </button>

                  {error && (
                    <div className={styles.error}>
                      {error}
                      {error === "Email and password do not match" && (
                        <div className={styles.errorHelp}>
                          <Link href="/forgot-password" className={styles.errorHelpLink}>
                            Forgot your password?
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </form>

                <div className={styles.formFooter}>
                  <p className={styles.formFooterText}>
                    Don't have an account?{" "}
                    <Link href="/mentor/signup" className={styles.formFooterLink}>
                      Become a Mentor
                    </Link>
                    {" "}or{" "}
                    <Link href="/mentee/signup" className={styles.formFooterLink}>
                      Find a Mentor
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
