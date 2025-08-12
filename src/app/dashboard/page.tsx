"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./dashboard.module.css";

export default function Dashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role);
        } else {
          // Redirect to signin if not authenticated
          router.push("/signin");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/signin");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.logo}>MentorAll</h1>
          <nav className={styles.nav}>
            <Link href="/profile" className={styles.navLink}>Profile</Link>
            <button 
              onClick={() => {
                fetch("/api/auth/signout", { method: "POST" });
                router.push("/");
              }} 
              className={styles.navLink}
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.welcomeSection}>
            <h2 className={styles.welcomeTitle}>
              Welcome to your {userRole === "mentor" ? "Mentor" : "Mentee"} Dashboard!
            </h2>
            <p className={styles.welcomeSubtitle}>
              {userRole === "mentor" 
                ? "Start helping others grow and share your expertise"
                : "Find the perfect mentor to guide your journey"
              }
            </p>
          </div>

          <div className={styles.contentGrid}>
            {userRole === "mentor" ? (
              <>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>👥 View Mentee Requests</h3>
                  <p className={styles.cardDescription}>
                    See who's looking for guidance and accept mentoring opportunities.
                  </p>
                  <Link href="/mentor/requests" className={styles.cardButton}>
                    View Requests
                  </Link>
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>📅 Manage Schedule</h3>
                  <p className={styles.cardDescription}>
                    Set your availability and manage mentoring sessions.
                  </p>
                  <Link href="/mentor/schedule" className={styles.cardButton}>
                    Manage Schedule
                  </Link>
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>📊 Your Impact</h3>
                  <p className={styles.cardDescription}>
                    Track your mentoring sessions and see your impact.
                  </p>
                  <Link href="/mentor/impact" className={styles.cardButton}>
                    View Stats
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>🔍 Find Mentors</h3>
                  <p className={styles.cardDescription}>
                    Browse available mentors and find the perfect match for your goals.
                  </p>
                  <Link href="/mentee/browse" className={styles.cardButton}>
                    Browse Mentors
                  </Link>
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>💬 My Connections</h3>
                  <p className={styles.cardDescription}>
                    View your current mentor connections and chat history.
                  </p>
                  <Link href="/mentee/connections" className={styles.cardButton}>
                    View Connections
                  </Link>
                </div>

                <div className={styles.card}>
                  <h3 className={styles.cardTitle}>📚 Learning Path</h3>
                  <p className={styles.cardDescription}>
                    Track your learning progress and set new goals.
                  </p>
                  <Link href="/mentee/learning" className={styles.cardButton}>
                    View Progress
                  </Link>
                </div>
              </>
            )}
          </div>

          <div className={styles.quickActions}>
            <h3 className={styles.quickActionsTitle}>Quick Actions</h3>
            <div className={styles.actionButtons}>
              <Link href="/profile" className={styles.actionButton}>
                ✏️ Edit Profile
              </Link>
              <Link href="/settings" className={styles.actionButton}>
                ⚙️ Settings
              </Link>
              <Link href="/help" className={styles.actionButton}>
                ❓ Help & Support
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
