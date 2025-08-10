import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.logo}>Mentor<span className={styles.aiHighlight}>AI</span>l</h1>
          <nav className={styles.nav}>
            <Link href="/mentor/signup" className={styles.navLink}>Create Account</Link>
            <Link href="/signin" className={styles.navLink}>Sign In</Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>Match, Talk, Track, Grow</h1>
            <p className={styles.description}>
              Join MentorAll to connect with mentors who can guide your journey, 
              or become a mentor to share your knowledge and make a difference.
            </p>
            
            <div className={styles.ctaButtons}>
              <Link href="/mentor/signup" className={styles.primary}>
                Become a Mentor
              </Link>
              <Link href="/mentee/signup" className={styles.secondary}>
                Get My Mentors
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <div className={styles.featureGrid}>
            <div className={styles.feature}>
              <h3>For Mentees</h3>
              <p>Find the perfect mentor to guide your personal and professional journey</p>
            </div>
            
            <div className={styles.feature}>
              <h3>For Mentors</h3>
              <p>Share your expertise and make a meaningful impact on someone's life</p>
            </div>
            
            <div className={styles.feature}>
              <h3>Smart Matching</h3>
              <p>Our intelligent algorithm connects you with the right people based on your goals</p>
            </div>
          </div>
        </section>

        <section className={styles.cta}>
          <div className={styles.ctaContent}>
            <h2>Ready to Get Started?</h2>
            <p>Join thousands of mentors and mentees building meaningful connections</p>
            <div className={styles.ctaButtons}>
              <Link href="/mentor/signup" className={styles.primary}>
                Start Mentoring
              </Link>
              <Link href="/mentee/signup" className={styles.secondary}>
                Get My Mentors
              </Link>
            </div>
          </div>
        </section>
      </main>
      
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p>&copy; 2025 MentorAll. Getting YOUR perfect mentors, for meaningful connections.</p>
          <div className={styles.footerLinks}>
            {/* <Link href="/dashboard" className={styles.footerLink}>Dashboard</Link>
            <Link href="/signin" className={styles.footerLink}>Sign In</Link> */}
          </div>
        </div>
      </footer>
    </div>
  );
}
