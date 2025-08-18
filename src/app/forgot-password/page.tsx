"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./forgotPassword.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // TODO: Implement actual password reset logic
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);
    } catch (err) {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/" className={styles.logoContainer}>
              <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
            </Link>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.content}>
              <div className={styles.formSection}>
                <div className={styles.formCard}>
                  <div className={styles.successContent}>
                    <h2 className={styles.formTitle}>Check Your Email</h2>
                    <p className={styles.formSubtitle}>
                      We've sent a password reset link to <strong>{email}</strong>
                    </p>
                    <div className={styles.actions}>
                      <Link href="/signin" className={styles.button}>
                        <span className={styles.buttonContent}>
                          Back to Sign In
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
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

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.formSection}>
              <div className={styles.formCard}>
                <h2 className={styles.formTitle}>Forgot Your Password?</h2>
                <p className={styles.formSubtitle}>
                  Enter your email address to receive a reset link
                </p>

                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>
                      <span className={styles.labelText}>Email Address</span>
                      <input
                        name="email"
                        type="email"
                        required
                        className={styles.input}
                        disabled={submitting}
                        autoComplete="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                  </div>

                  {error && <div className={styles.error}>{error}</div>}

                  <button type="submit" disabled={submitting} className={styles.button}>
                    <span className={styles.buttonContent}>
                      {submitting ? (
                        <>
                          <div className={styles.spinner}></div>
                          Sending...
                        </>
                      ) : (
                        "Send Reset Link"
                      )}
                    </span>
                  </button>
                </form>

                <div className={styles.formFooter}>
                  <p className={styles.formFooterText}>
                    Remember your password?{" "}
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
