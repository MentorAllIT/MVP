"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
      <div className={styles.page}>

        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/" className={styles.logoContainer}>
              <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo}/>
            </Link>
            <nav className={styles.nav}>
              Already have an account?
              {/* <Link href="/mentor/signup" className={styles.navLink}>Sign Up</Link> */}
              <Link href="/signin" className={styles.navLink}>Sign In</Link>
            </nav>
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.hero}>
            <div className={styles.heroContent}>
              <h1 className={styles.title}>Match, Talk, Track, Grow</h1>
              <p className={styles.description}>
                Join MentorAll to find the mentors who perfectly fit your current position.
                Or join us as a mentor to share your knowledge and make the impact.
              </p>

              {/* Clickable Role Selection Links */}
              <div className={styles.roleSelectionLinks}>
                <h3 className={styles.roleSelectionTitle}>Create Account</h3>
                <div className={styles.roleLinks}>
                  <Link href="/mentor/signup" className={styles.roleLink}>
                    <span className={styles.roleLinkIcon}>🎯</span>
                    <span className={styles.roleLinkText}>Become a Mentor</span>
                  </Link>
                  <Link href="/mentee/signup" className={styles.roleLink}>
                    <span className={styles.roleLinkIcon}>🚀</span>
                    <span className={styles.roleLinkText}>Find My Mentor</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.features}>
            <h2 className={styles.sectionTitle}>How It Works</h2>
            <div className={styles.featureGrid}>
              <div className={styles.feature}>
                <h3>Smart Matching</h3>
                <p>Our intelligent algorithm connects you with the right people based on your priorities.</p>
              </div>

              <div className={styles.feature}>
                <h3>Pre-session Services</h3>
                <p>We provide you with a tailored preparation package, including research on the mentor’s profile,
                  suggested questions to ask, and other resources to ensure a productive session.</p>
              </div>

              <div className={styles.feature}>
                <h3>Post-session Reflection</h3>
                <p>We guide you through a structured reflection process to capture key insights and plan your next
                  steps.</p>
              </div>


            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <p>&copy; 2025 MentorAll. Getting YOUR perfect mentors, for meaningful connections.</p>
          </div>
        </footer>
      </div>
  );
}
