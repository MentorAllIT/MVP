"use client";

import { Suspense, useState, useEffect } from "react";
import BookingForm from "../components/BookingForm";
import MentorBookingForm from "../mentors2/components/MentorBookingFormNew";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../mentee/browse/browse.module.css";

// Avoid static generation for this page (optional but nice here)
export const dynamic = "force-dynamic";

function BookingPageInner() {
  const searchParams = useSearchParams();
  const mentorId = searchParams.get('mentorId');
  const mentorName = searchParams.get('mentorName');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  
  // Get current user from JWT token
  useEffect(() => {
    const getUserFromToken = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.uid);
        }
      } catch (error) {
        console.error('Error getting user from token:', error);
      } finally {
        setUserLoading(false);
      }
    };
    
    getUserFromToken();
  }, []);

  const pageTitle = mentorId && mentorName 
    ? `Book a Session with ${decodeURIComponent(mentorName)}`
    : "Book a Meeting";

  const pageSubtitle = mentorId && mentorName
    ? "Schedule your mentoring session and start your journey"
    : "Schedule a mentoring session with someone from the community";

  // Show loading state while fetching user
  if (userLoading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/" className={styles.logo}>MentorAll</Link>
            <nav className={styles.nav}>
              <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
              <Link href="/profile" className={styles.navLink}>Profile</Link>
              <Link href="/settings" className={styles.navLink}>Settings</Link>
            </nav>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Loading...</h1>
              <p className={styles.subtitle}>Preparing your booking form.</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>MentorAll</Link>
          <nav className={styles.nav}>
            <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
            <Link href="/profile" className={styles.navLink}>Profile</Link>
            <Link href="/settings" className={styles.navLink}>Settings</Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h1 className={styles.title}>{pageTitle}</h1>
            <p className={styles.subtitle}>{pageSubtitle}</p>
          </section>

          <div style={{ 
            maxWidth: "800px", 
            margin: "0 auto", 
            padding: "2rem",
            background: "rgba(255, 255, 255, 0.9)",
            borderRadius: "20px",
            border: "1px solid rgba(102, 77, 162, 0.1)",
            boxShadow: "0 10px 40px rgba(102, 77, 162, 0.1)",
            backdropFilter: "blur(20px)"
          }}>
            {/* If mentorId is provided, use MentorBookingForm */}
            {mentorId && mentorName ? (
              <MentorBookingForm 
                mentorName={decodeURIComponent(mentorName)}
                mentorUsername={mentorId} // Using mentorId as username for now
                mentorUserId={mentorId}
              />
            ) : (
              /* Default booking form for general bookings */
              <BookingForm 
                currentUserId={currentUserId || undefined} 
                preselectedMentorId={mentorId || undefined}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Loading booking…</h1>
              <p className={styles.subtitle}>Preparing your booking form.</p>
            </section>
          </div>
        </div>
      }
    >
      <BookingPageInner />
    </Suspense>
  );
}
