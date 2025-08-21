'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './resetPassword.module.css';

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setMessage('Invalid reset link. Please request a new password reset.');
      setMessageType('error');
      setTokenValid(false);
    } else {
      setTokenValid(true);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setMessage('Invalid reset link. Please request a new password reset.');
      setMessageType('error');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters long');
      setMessageType('error');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token, 
          password, 
          confirmPassword 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setMessageType('success');
        
        // Clear the password reset countdown flag
        localStorage.removeItem('passwordResetCountdownStart');
        
        // Redirect to signin page after 3 seconds
        setTimeout(() => {
          router.push('/signin');
        }, 3000);
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

  if (!tokenValid) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.errorCard}>
            <h1 className={styles.title}>Invalid Reset Link</h1>
            <p className={styles.errorMessage}>
              The password reset link is invalid or has expired.
            </p>
            <Link href="/forgot-password" className={styles.link}>
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <Link href="/signin" className={styles.backLink}>
            ← Back to Sign In
          </Link>
          <h1 className={styles.title}>Reset Your Password</h1>
          <p className={styles.subtitle}>
            Enter your new password below. Make sure it's secure and memorable.
          </p>
        </div>

        <div className={styles.formCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="Enter your new password"
                required
                minLength={8}
                disabled={submitting}
              />
              <small className={styles.helpText}>
                Password must be at least 8 characters long
              </small>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                placeholder="Confirm your new password"
                required
                disabled={submitting}
              />
            </div>

            {message && (
              <div className={`${styles.message} ${styles[messageType]}`}>
                {message}
                {messageType === 'success' && (
                  <p className={styles.redirectMessage}>
                    Redirecting to sign in page...
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={styles.submitButton}
            >
              {submitting ? (
                <span className={styles.buttonContent}>
                  <span className={styles.spinner}></span>
                  Resetting Password...
                </span>
              ) : (
                'Reset Password'
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
          <h3>Password Requirements:</h3>
          <ul>
            <li>At least 8 characters long</li>
            <li>Use a mix of letters, numbers, and symbols</li>
            <li>Avoid common passwords</li>
            <li>Don't reuse passwords from other accounts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
