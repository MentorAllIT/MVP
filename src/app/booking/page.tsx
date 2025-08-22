"use client";

import { Suspense, useState, useEffect } from "react";
import BookingForm from "../components/BookingForm";
import MentorBookingForm from "../mentors2/components/MentorBookingFormNew";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../mentee/browse/browse.module.css";
import HamburgerMenu from "../components/HamburgerMenu";

// Avoid static generation for this page (optional but nice here)
export const dynamic = "force-dynamic";

function BookingPageInner() {
  const searchParams = useSearchParams();
  const mentorId = searchParams.get('mentorId');
  const mentorName = searchParams.get('mentorName');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [fetchedMentorName, setFetchedMentorName] = useState<string | null>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  
  // Get current user from JWT token
  useEffect(() => {
    const getUserFromToken = async () => {
      try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.uid);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      } finally {
        setUserLoading(false);
      }
    };
    
    getUserFromToken();
  }, []);

  // Fetch mentor name if mentorId is provided but mentorName is not
  useEffect(() => {
    const fetchMentorName = async () => {
      if (mentorId && !mentorName) {
        setMentorLoading(true);
        try {
          const response = await fetch(`/api/users?uid=${encodeURIComponent(mentorId)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.name) {
              setFetchedMentorName(data.name);
            }
          }
        } catch (error) {
          console.error('Error fetching mentor name:', error);
        } finally {
          setMentorLoading(false);
        }
      }
    };

    fetchMentorName();
  }, [mentorId, mentorName]);

  // Determine the actual mentor name to use
  const actualMentorName = mentorName ? decodeURIComponent(mentorName) : fetchedMentorName;

  const pageTitle = mentorId && actualMentorName 
    ? `Book a Session with ${actualMentorName}`
    : "Book a Meeting";

  const pageSubtitle = mentorId && actualMentorName
    ? "Schedule your mentoring session and start your journey"
    : "Schedule a mentoring session with someone from the community";

  // Show loading state while fetching user or mentor data
  if (userLoading || (mentorId && !mentorName && mentorLoading)) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/dashboard" className={styles.logoContainer}>
            <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
          </Link>
          <HamburgerMenu />
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
          <Link href="/dashboard" className={styles.logoContainer}>
            <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
          </Link>
          <HamburgerMenu />
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
            {mentorId && actualMentorName ? (
              <MentorBookingForm 
                mentorName={actualMentorName}
                mentorUsername={mentorId} // Using mentorId as username for now
                mentorUserId={mentorId}
              />
            ) : mentorId && !actualMentorName ? (
              /* Show loading state if we have mentorId but name is still loading */
              <div style={{ textAlign: "center", padding: "2rem" }}>
                <p>Loading mentor information...</p>
              </div>
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
