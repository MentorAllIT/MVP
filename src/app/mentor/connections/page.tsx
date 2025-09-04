"use client";

import Link from "next/link";
import styles from "./connections.module.css";
import HamburgerMenu from "../../components/HamburgerMenu";

export default function MenteeConnectionsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>My Mentees</h1>
          <HamburgerMenu theme="light" />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h2 className={styles.subtitle}>Build Strong Mentoring Relationships</h2>
            <p className={styles.description}>
              Manage your mentee relationships, track progress, and keep everything organized in one place.
            </p>
          </section>

          <div className={styles.content}>
            <div className={styles.placeholderCard}>
              <div className={styles.placeholderIcon}></div>
              <h3>Connections Coming Soon</h3>
              <p>
                We're working on building a connections system where you can:
              </p>
              <ul className={styles.featureList}>
                <li>• View all your mentee connections</li>
                <li>• Track your mentoring relationships</li>
                <li>• Manage your professional network</li>
              </ul>
              <div className={styles.actions}>
                <Link href="/mentee/browse" className={styles.primaryButton}>
                  Browse Mentors
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
