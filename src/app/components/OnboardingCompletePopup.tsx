'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './OnboardingCompletePopup.module.css';

interface OnboardingCompletePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingCompletePopup({ isOpen, onClose }: OnboardingCompletePopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div className={`${styles.overlay} ${isOpen ? styles.open : ''}`}>
      <div className={styles.popup}>
        <div className={styles.header}>
          <h2 className={styles.title}>🎉 Congratulations!</h2>
          <p className={styles.subtitle}>You've completed your onboarding!</p>
        </div>
        
        <div className={styles.content}>
          <div className={styles.icon}>✨</div>
          <p className={styles.message}>
            We're excited to have you on board! Our magic matching system is being fine-tuned 
            to ensure you meet your perfect mentor.
          </p>
          <p className={styles.timeline}>
            <strong>Please stay tuned - we'll reach out in a few days</strong> when the 
            matching is ready and you can start connecting with amazing mentors!
          </p>
        </div>

        <div className={styles.actions}>
          <button onClick={onClose} className={styles.primaryButton}>
            Got it, I'll wait!
          </button>
          <Link href="/profile" className={styles.secondaryButton}>
            Review My Profile
          </Link>
        </div>

        <button onClick={onClose} className={styles.closeButton}>
          ×
        </button>
      </div>
    </div>
  );
}
