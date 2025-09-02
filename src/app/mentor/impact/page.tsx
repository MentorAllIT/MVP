"use client";

import { useRouter } from "next/navigation";
import styles from "./impact.module.css";

export default function MentorImpactPage() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.iconContainer}>
            <div className={styles.icon}>📊</div>
          </div>
          
          <h1 className={styles.title}>Impact Analytics</h1>
          <h2 className={styles.subtitle}>Coming Soon</h2>
          
          <p className={styles.description}>
            We're building powerful analytics to help you track your mentoring impact, 
            including mentee progress, session effectiveness, and growth metrics.
          </p>
          
          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>📈</span>
              <span>Session Analytics</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>🎯</span>
              <span>Goal Tracking</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>💡</span>
              <span>Impact Reports</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>⭐</span>
              <span>Success Stories</span>
            </div>
          </div>
          
          <p className={styles.exploreText}>
            For now, please explore other features:
          </p>
          
          <div className={styles.actions}>
            <button 
              onClick={() => router.push("/mentor/schedule")}
              className={styles.primaryButton}
            >
              Manage Schedule
            </button>
            <button 
              onClick={() => router.push("/mentor/requests")}
              className={styles.secondaryButton}
            >
              View Requests
            </button>
            <button 
              onClick={() => router.push("/dashboard")}
              className={styles.secondaryButton}
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
