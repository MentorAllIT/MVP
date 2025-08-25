'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './forgotPassword.module.css';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [hasRequestedReset, setHasRequestedReset] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Only check localStorage if we're in the middle of a countdown
  useEffect(() => {
    const countdownStart = localStorage.getItem('passwordResetCountdownStart');
    if (countdownStart) {
      const elapsed = Math.floor((Date.now() - parseInt(countdownStart)) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      
      if (remaining > 0) {
        setCountdown(remaining);
        setHasRequestedReset(false);
      } else {
        setHasRequestedReset(true);
        localStorage.removeItem('passwordResetCountdownStart');
      }
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setHasRequestedReset(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMessage('Please enter your email address');
      setMessageType('error');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        // Start 60-second countdown
        setCountdown(60);
        setHasRequestedReset(false);
        localStorage.setItem('passwordResetCountdownStart', Date.now().toString());
        
        // Show success message without auto-redirect
        setMessage('Password reset link sent! Check your email and follow the instructions.');
        setMessageType('success');
        setEmail('');
      } else {
        setMessage(data.error || 'An error occurred. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Network error. Please check your connection and try again.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>

          <h1 className={styles.title}>Forgot Password</h1>
                    <p className={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <div className={styles.formCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="Enter your email address"
                required
                disabled={submitting}
              />
            </div>

            {message && (
              <div className={`${styles.message} ${styles[messageType]}`}>
                {message}
                {messageType === 'success' && (
                  <div className={styles.successActions}>
                    <Link href="/signin" className={styles.goToSigninButton}>
                      Sign In
                    </Link>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || countdown > 0}
              className={styles.submitButton}
            >
              {submitting ? (
                <span className={styles.buttonContent}>
                  <span className={styles.spinner}></span>
                  Sending Reset Link...
                </span>
              ) : countdown > 0 ? (
                <span className={styles.buttonContent}>
                  <span className={styles.countdown}>{countdown}s</span>
                  Resend Reset Link
                </span>
              ) : (
                hasRequestedReset ? 'Resend Reset Link' : 'Send Reset Link'
              )}
            </button>
          </form>

          <div className={styles.helpText}>
            <p>
              Remember your password?{' '}
              <Link href="/signin" className={styles.link}>
                Sign in here
              </Link>
            </p>
          </div>
        </div>

        <div className={styles.info}>
          <h3>How it works:</h3>
          <ol>
            <li>Enter your email address above</li>
            <li>Check your email for a password reset link</li>
            <li>Click the link and enter your new password</li>
            <li>Sign in with your new password</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
