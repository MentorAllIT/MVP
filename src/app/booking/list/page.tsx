"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../mentee/browse/browse.module.css";
import { formatToAEST } from "../../../lib/timezone";

interface Booking {
  id: string;
  bookingId: string;
  bookerName: string;
  bookerEmail: string;
  inviteeName: string;
  inviteeEmail: string;
  meetingTime: string;
  status: string;
  notes?: string;
  createdAt?: string;
  icsFileUrl?: string;
}

export default function BookingsListPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user from JWT token
  useEffect(() => {
    const getUserFromToken = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.uid);
        } else {
          setError("Please sign in to view your bookings");
        }
      } catch (error) {
        console.error('Error getting user from token:', error);
        setError("Authentication error");
      }
    };
    
    getUserFromToken();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadBookings();
    }
  }, [currentUserId]);

  const loadBookings = async () => {
    if (!currentUserId) {
      setError("Please sign in to view your bookings");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/booking?userId=${currentUserId}`);
      const data = await response.json();

      console.log("Booking API response:", data);
      console.log("Response status:", response.ok);

      if (response.ok) {
        setBookings(data.bookings || []);
        console.log("Bookings set:", data.bookings || []);
      } else {
        setError(data.error || "Failed to load bookings");
        console.error("API error:", data.error);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Error loading bookings");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return formatToAEST(dateString);
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  const filteredBookings = {
    upcoming: bookings.filter(b => isUpcoming(b.meetingTime)),
    past: bookings.filter(b => !isUpcoming(b.meetingTime))
  };

  console.log("All bookings:", bookings);
  console.log("Upcoming bookings:", filteredBookings.upcoming);
  console.log("Past bookings:", filteredBookings.past);
  console.log("Current time:", new Date().toISOString());

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/" className={styles.logo}>MentorAll</Link>
            <nav className={styles.nav}>
              <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
              <Link href="/booking/list" className={styles.navLink}>My Booking</Link>
              <Link href="/profile" className={styles.navLink}>Profile</Link>
            </nav>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Loading your bookings...</h1>
              <p className={styles.subtitle}>Please wait while we fetch your meeting information</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/" className={styles.logo}>MentorAll</Link>
            <nav className={styles.nav}>
              <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
              <Link href="/booking/list" className={styles.navLink}>My Bookings</Link>
              <Link href="/profile" className={styles.navLink}>Profile</Link>
            </nav>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Error Loading Bookings</h1>
              <p className={styles.subtitle}>{error}</p>
            </section>
            
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>⚠️</div>
              <h3>Something went wrong</h3>
              <p>We couldn&apos;t load your bookings at this time.</p>
              <button onClick={loadBookings} className={styles.ctaButton}>Try Again</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/" className={styles.logo}>MentorAll</Link>
            <nav className={styles.nav}>
              <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
              <Link href="/booking" className={styles.navLink}>My Booking</Link>
              <Link href="/profile" className={styles.navLink}>Profile</Link>
            </nav>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>My Bookings</h1>
              <p className={styles.subtitle}>Manage your meeting invitations and appointments</p>
            </section>
            
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>📅</div>
              <h3>No Bookings Found</h3>
              <p>You haven&apos;t created or received any bookings yet.</p>
              <Link href="/mentee/browse" className={styles.ctaButton}>Create Your First Booking</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const bookingsList = (
    <div style={{ 
      maxWidth: "1200px", 
      margin: "0 auto", 
      padding: "0 1rem" 
    }}>
      {/* Upcoming Bookings */}
      {filteredBookings.upcoming.length > 0 && (
        <div style={{ marginBottom: "3rem" }}>
          <h2 style={{ 
            fontSize: "1.5rem", 
            fontWeight: "700", 
            color: "#2d1b69", 
            marginBottom: "1.5rem",
            borderBottom: "3px solid rgba(102, 77, 162, 0.1)",
            paddingBottom: "0.5rem"
          }}>
            Upcoming Meetings
          </h2>
          <div style={{ 
            display: "grid", 
            gap: "1.5rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))"
          }}>
            {filteredBookings.upcoming.map((booking) => (
              <div 
                key={booking.bookingId} 
                style={{ 
                  padding: "1.5rem", 
                  background: "rgba(255, 255, 255, 0.9)",
                  borderRadius: "20px",
                  border: "1px solid rgba(102, 77, 162, 0.1)",
                  boxShadow: "0 10px 40px rgba(102, 77, 162, 0.1)",
                  backdropFilter: "blur(20px)",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s"
                }}
                onClick={() => router.push(`/booking/details/${booking.bookingId}`)}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 15px 50px rgba(102, 77, 162, 0.15)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 10px 40px rgba(102, 77, 162, 0.1)";
                }}
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  marginBottom: "1rem",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "#2d1b69"
                }}>
                  <span>{booking.bookerName}</span>
                  <span style={{ margin: "0 0.5rem", color: "#a855f7" }}>→</span>
                  <span>{booking.inviteeName}</span>
                </div>
                
                <div style={{ 
                  fontSize: "0.875rem", 
                  color: "#6b7280", 
                  marginBottom: "1rem",
                  padding: "0.75rem",
                  backgroundColor: "rgba(102, 77, 162, 0.05)",
                  borderRadius: "10px"
                }}>
                  📅 {formatDateTime(booking.meetingTime)}
                </div>
                
                <div style={{ 
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <span style={{
                    padding: "0.5rem 1rem", 
                    borderRadius: "15px", 
                    fontSize: "0.75rem", 
                    fontWeight: "600",
                    textTransform: "uppercase",
                    backgroundColor: booking.status === "Confirmed" ? "#dcfce7" : 
                                   booking.status === "Rescheduled" ? "#fef3c7" : "#f3f4f6",
                    color: booking.status === "Confirmed" ? "#166534" : 
                           booking.status === "Rescheduled" ? "#92400e" : "#6b7280",
                    border: `1px solid ${
                      booking.status === "Confirmed" ? "#16a34a" : 
                      booking.status === "Rescheduled" ? "#f59e0b" : "#d1d5db"
                    }`
                  }}>
                    {booking.status}
                  </span>
                  
                  <div style={{ 
                    fontSize: "0.875rem", 
                    color: "#4f46e5",
                    fontWeight: "500"
                  }}>
                    View Details →
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Past Bookings */}
      {filteredBookings.past.length > 0 && (
        <div>
          <h2 style={{ 
            fontSize: "1.5rem", 
            fontWeight: "700", 
            color: "#2d1b69", 
            marginBottom: "1.5rem",
            borderBottom: "3px solid rgba(102, 77, 162, 0.1)",
            paddingBottom: "0.5rem"
          }}>
            Past Meetings
          </h2>
          <div style={{ 
            display: "grid", 
            gap: "1.5rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))"
          }}>
            {filteredBookings.past.map((booking) => (
              <div 
                key={booking.bookingId} 
                style={{ 
                  padding: "1.5rem", 
                  background: "rgba(255, 255, 255, 0.7)",
                  borderRadius: "20px",
                  border: "1px solid rgba(102, 77, 162, 0.05)",
                  boxShadow: "0 10px 40px rgba(102, 77, 162, 0.05)",
                  backdropFilter: "blur(20px)",
                  cursor: "pointer",
                  opacity: "0.8",
                  transition: "transform 0.2s, box-shadow 0.2s, opacity 0.2s"
                }}
                onClick={() => router.push(`/booking/details/${booking.bookingId}`)}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 15px 50px rgba(102, 77, 162, 0.1)";
                  e.currentTarget.style.opacity = "1";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 10px 40px rgba(102, 77, 162, 0.05)";
                  e.currentTarget.style.opacity = "0.8";
                }}
              >
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  marginBottom: "1rem",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "#6b7280"
                }}>
                  <span>{booking.bookerName}</span>
                  <span style={{ margin: "0 0.5rem", color: "#9ca3af" }}>→</span>
                  <span>{booking.inviteeName}</span>
                </div>
                
                <div style={{ 
                  fontSize: "0.875rem", 
                  color: "#9ca3af", 
                  marginBottom: "1rem",
                  padding: "0.75rem",
                  backgroundColor: "rgba(102, 77, 162, 0.03)",
                  borderRadius: "10px"
                }}>
                  📅 {formatDateTime(booking.meetingTime)}
                </div>
                
                <div style={{ 
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <span style={{
                    padding: "0.5rem 1rem", 
                    borderRadius: "15px", 
                    fontSize: "0.75rem", 
                    fontWeight: "600",
                    textTransform: "uppercase",
                    backgroundColor: "#f3f4f6",
                    color: "#6b7280",
                    border: "1px solid #d1d5db"
                  }}>
                    {booking.status}
                  </span>
                  
                  <div style={{ 
                    fontSize: "0.875rem", 
                    color: "#6b7280",
                    fontWeight: "500"
                  }}>
                    View Details →
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logo}>MentorAll</Link>
          <nav className={styles.nav}>
            <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
            <Link href="/booking/list" className={styles.navLink}>My Bookings</Link>
            <Link href="/profile" className={styles.navLink}>Profile</Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h1 className={styles.title}>My Bookings</h1>
            <p className={styles.subtitle}>Manage your meeting invitations and appointments</p>
            
            <div style={{ marginTop: "2rem" }}>
              <Link href="/mentee/browse" className={styles.ctaButton}>
                + Browse Mentors and Create Booking
              </Link>
            </div>
          </section>

          <section style={{ marginTop: "3rem" }}>
            {bookingsList}
          </section>
        </div>
      </main>
    </div>
  );
}
