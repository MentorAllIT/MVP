"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../mentee/browse/browse.module.css";
import { formatToAEST } from "../../../lib/timezone";
import HamburgerMenu from "../../components/HamburgerMenu";

interface BookingRequest {
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
}

export default function MentorRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user from JWT token
  useEffect(() => {
    const getUserFromToken = async () => {
      try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
          const data = await response.json();
          console.log('🔐 Auth check data:', data);
          setCurrentUserId(data.uid);
          
          // Verify user is a mentor
          if (data.role !== 'mentor') {
            setError("Access denied. This page is for mentors only.");
            return;
          }
        } else {
          setError("Please sign in to view your requests");
          router.push('/signin');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setError("Authentication error");
      }
    };
    
    getUserFromToken();
  }, [router]);

  // Fetch pending booking requests for the mentor
  useEffect(() => {
    const fetchRequests = async () => {
      if (!currentUserId) return;

      try {
        console.log('📡 Fetching mentor requests for userId:', currentUserId);
        
        // Fetch bookings where this user is the mentor (invitee) and status is pending
        const response = await fetch(`/api/booking?userId=${currentUserId}&role=mentor`);
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('📡 Response error:', errorText);
          throw new Error(`Failed to fetch booking requests: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('📋 Raw booking data:', data);
        console.log('📋 Data type:', typeof data);
        
        // The API returns { bookings: [...] }, so we need to extract the bookings array
        const bookingsArray = data.bookings || data;
        console.log('📋 Bookings array:', bookingsArray);
        console.log('📋 Is array:', Array.isArray(bookingsArray));
        
        // Check if bookingsArray is an array before filtering
        if (!Array.isArray(bookingsArray)) {
          console.error('📋 Bookings is not an array:', bookingsArray);
          throw new Error('Invalid data format received from API');
        }
        
        // Filter for only pending requests
        const pendingRequests = bookingsArray.filter((booking: any) => 
          booking.status === 'Pending'
        );
        
        console.log('⏳ Pending requests:', pendingRequests);
        setRequests(pendingRequests);
        
      } catch (error) {
        console.error('Error fetching requests:', error);
        setError(`Failed to load booking requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [currentUserId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/" className={styles.logoContainer}>
              <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
            </Link>
            <HamburgerMenu />
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Loading your booking requests...</h1>
              <p className={styles.subtitle}>Please wait while we fetch your pending requests</p>
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
            <Link href="/" className={styles.logoContainer}>
              <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
            </Link>
            <HamburgerMenu />
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Error Loading Requests</h1>
              <p className={styles.subtitle}>{error}</p>
            </section>
            
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>⚠️</div>
              <h3>Something went wrong</h3>
              <p>We couldn&apos;t load your booking requests at this time.</p>
              <Link href="/dashboard" className={styles.ctaButton}>Go to Dashboard</Link>
            </div>
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
            <h1 className={styles.title}>📬 Booking Requests</h1>
            <p className={styles.subtitle}>
              Pending booking requests from mentees
            </p>
          </section>

          {requests.length === 0 ? (
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>✨</div>
              <h3>No booking requests yet</h3>
              <p>Your mentoring journey is just beginning! When mentees discover your profile and want to book sessions with you, their requests will appear here.</p>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
                <Link href="/profile" className={styles.ctaButton}>
                  ✏️ Complete Your Profile
                </Link>
                <Link href="/dashboard" className={styles.ctaButton}>
                  📊 Go to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ 
              maxWidth: "1200px", 
              margin: "2rem auto 0", 
              padding: "0 1rem" 
            }}>
              <div style={{ 
                display: "grid", 
                gap: "1.5rem",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))"
              }}>
                {requests.map((request) => (
                  <div 
                    key={request.id} 
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
                    onClick={() => router.push(`/booking/confirm/${request.bookingId}`)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-5px)";
                      e.currentTarget.style.boxShadow = "0 15px 50px rgba(102, 77, 162, 0.15)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 10px 40px rgba(102, 77, 162, 0.1)";
                    }}
                  >
                    {/* Status Badge */}
                    <div style={{ 
                      position: "absolute", 
                      top: "-10px", 
                      right: "20px",
                      padding: "0.5rem 1rem", 
                      borderRadius: "15px", 
                      fontSize: "0.75rem", 
                      fontWeight: "600",
                      textTransform: "uppercase",
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                      border: "1px solid #f59e0b"
                    }}>
                      ⏳ Pending
                    </div>

                    {/* Mentee Info */}
                    <div style={{ marginBottom: "1rem" }}>
                      <h3 style={{ 
                        fontSize: "1.125rem", 
                        fontWeight: "600", 
                        color: "#2d1b69", 
                        marginBottom: "0.5rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem"
                      }}>
                        📚 {request.bookerName}
                      </h3>
                      <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                        {request.bookerEmail}
                      </p>
                    </div>

                    {/* Meeting Time */}
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        padding: "0.75rem",
                        backgroundColor: "rgba(102, 77, 162, 0.05)",
                        borderRadius: "8px",
                        border: "1px solid rgba(102, 77, 162, 0.1)"
                      }}>
                        <span style={{ fontWeight: "600", color: "#2d1b69", minWidth: "120px" }}>📅 Meeting Time:</span>
                        <span style={{ color: "#4b5563" }}>{formatToAEST(request.meetingTime)}</span>
                      </div>
                    </div>

                    {/* Notes */}
                    {request.notes && (
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ 
                          padding: "1rem", 
                          background: "linear-gradient(135deg, #fef7e3 0%, #fde68a 20%)", 
                          borderRadius: "8px", 
                          border: "1px solid #f59e0b",
                          borderLeft: "4px solid #f59e0b"
                        }}>
                          <div style={{ fontWeight: "600", color: "#92400e", marginBottom: "0.5rem" }}>
                            📝 Notes:
                          </div>
                          <p style={{ 
                            color: "#92400e", 
                            margin: 0,
                            lineHeight: "1.5",
                            fontSize: "0.875rem"
                          }}>
                            {request.notes}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Booking ID */}
                    <div style={{ 
                      fontSize: "0.75rem", 
                      color: "#9ca3af", 
                      textAlign: "center",
                      marginBottom: "1rem",
                      paddingTop: "1rem",
                      borderTop: "1px solid rgba(102, 77, 162, 0.1)"
                    }}>
                      Booking ID: {request.bookingId}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ 
                      display: "flex", 
                      gap: "0.75rem", 
                      justifyContent: "center" 
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/booking/confirm/${request.bookingId}`);
                        }}
                        style={{
                          padding: "0.75rem 1.5rem",
                          background: "#28a745",
                          color: "white",
                          border: "none",
                          borderRadius: "10px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          fontSize: "0.875rem"
                        }}
                      >
                        ✅ Review & Respond
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/booking/details/${request.bookingId}`);
                        }}
                        style={{
                          padding: "0.75rem 1.5rem",
                          background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                          color: "white",
                          border: "none",
                          borderRadius: "10px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          fontSize: "0.875rem"
                        }}
                      >
                        👁️ View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Navigation */}
          <div style={{ 
            textAlign: "center",
            marginTop: "3rem",
            paddingTop: "2rem",
            borderTop: "1px solid rgba(102, 77, 162, 0.1)"
          }}>
            <Link 
              href="/dashboard"
              style={{
                background: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
                color: "white",
                padding: "0.75rem 2rem",
                borderRadius: "10px",
                textDecoration: "none",
                fontWeight: "600",
                transition: "all 0.3s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
