"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./requests.module.css";
import { formatToAEST } from "../../../lib/timezone";

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
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading your booking requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2>Error</h2>
          <p>{error}</p>
          <Link href="/dashboard" className={styles.backButton}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📬 Booking Requests</h1>
        <p className={styles.subtitle}>
          Pending booking requests from mentees
        </p>
      </div>

      {requests.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✨</div>
          <h3>No booking requests yet</h3>
          <p>Your mentoring journey is just beginning! When mentees discover your profile and want to book sessions with you, their requests will appear here.</p>
          <div className={styles.emptyActions}>
            <Link href="/profile" className={styles.profileLink}>
              ✏️ Complete Your Profile
            </Link>
            <Link href="/dashboard" className={styles.dashboardLink}>
              📊 Go to Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.bookingsGrid}>
          {requests.map((request) => (
            <div key={request.id} className={styles.bookingCard}>
                            <div className={styles.cardHeader}>
                <div className={styles.statusBadge} data-status="pending">
                  ⏳ Pending
                </div>
                <div className={styles.bookingId}>
                  ID: {request.bookingId}
                </div>
              </div>

              <div className={styles.cardContent}>
                <div className={styles.menteeInfo}>
                  <h3 className={styles.menteeName}>
                    📚 {request.bookerName}
                  </h3>
                  <p className={styles.menteeEmail}>{request.bookerEmail}</p>
                </div>

                <div className={styles.meetingDetails}>
                  <div className={styles.dateTime}>
                    <span className={styles.label}>📅 Meeting Time:</span>
                    <span className={styles.value}>
                      {formatToAEST(request.meetingTime)}
                    </span>
                  </div>
                </div>

                {request.notes && (
                  <div className={styles.notes}>
                    <span className={styles.label}>📝 Notes:</span>
                    <p className={styles.noteText}>{request.notes}</p>
                  </div>
                )}
              </div>

              <div className={styles.cardActions}>
                <Link 
                  href={`/booking/confirm/${request.bookingId}`}
                  className={styles.confirmButton}
                >
                  ✅ Review & Respond
                </Link>
                <Link 
                  href={`/booking/details/${request.bookingId}`}
                  className={styles.detailsButton}
                >
                  👁️ View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.bottomActions}>
        <Link href="/dashboard" className={styles.backToDashboard}>
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
