"use client";

import Link from "next/link";
import styles from "./learning.module.css";
import HamburgerMenu from "../../components/HamburgerMenu";

export default function MenteeLearningPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Learning Resources</h1>
          <HamburgerMenu theme="light" />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          {/* <section className={styles.hero}>
            <h2 className={styles.subtitle}>Accelerate Your Growth</h2>
            <p className={styles.description}>
              Access curated learning materials, courses, and resources to complement your mentoring journey.
            </p>
          </section> */}

          <div className={styles.content}>
            <div className={styles.placeholderCard}>
              <div className={styles.placeholderIcon}></div>
              <h3>Learning Hub Coming Soon</h3>
              <p>
                We're building a learning hub where you can:
              </p>
              <ul className={styles.featureList}>
                <li>• Track your current progress</li>
                <li>• Get access to your own reflection notes</li>
                <li>• Watch recording of the mentoring sessions</li>
              </ul>
              <div className={styles.actions}>
                <Link href="/mentee/browse" className={styles.primaryButton}>
                  Find a Mentor
                </Link>
                <Link href="/dashboard" className={styles.secondaryButton}>
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
