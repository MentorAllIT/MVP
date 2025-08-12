'use client';

import { useState, useEffect } from 'react';
import styles from './CalendlyBookingDetails.module.css';

interface CalendlyBookingData {
  BookingID: string;
  CalendlyEventURI?: string;
  CalendlyInviteeURI?: string;
  CalendlyEventId?: string;
  InviteeName: string;
  InviteeEmail: string;
  InviteeTimezone?: string;
  OrganizerName: string;
  OrganizerEmail: string;
  MeetingLocation?: string;
  MeetingNotes?: string;
  CancelUrl?: string;
  RescheduleUrl?: string;
  QuestionsAndAnswers?: string;
  SyncedFromCalendly?: boolean;
  WebhookEvent?: string;
  EndTime?: string;
  CancellationTime?: string;
}

interface CalendlyBookingDetailsProps {
  booking: CalendlyBookingData;
  onSync?: () => void;
}

export default function CalendlyBookingDetails({ booking, onSync }: CalendlyBookingDetailsProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  const parseLocation = (locationStr?: string) => {
    if (!locationStr) return null;
    try {
      return JSON.parse(locationStr);
    } catch {
      return { type: 'unknown', location: locationStr };
    }
  };

  const parseQuestionsAndAnswers = (qaStr?: string) => {
    if (!qaStr) return [];
    try {
      return JSON.parse(qaStr);
    } catch {
      return [];
    }
  };

  const handleManualSync = async () => {
    if (!booking.CalendlyEventURI) return;
    
    setSyncing(true);
    setSyncStatus('');
    
    try {
      const response = await fetch('/api/calendly/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventUri: booking.CalendlyEventURI })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSyncStatus(`✅ Sync successful: ${data.action}`);
        if (onSync) onSync();
      } else {
        setSyncStatus(`❌ Sync failed: ${data.error}`);
      }
    } catch (error) {
      setSyncStatus('❌ Sync failed: Network error');
    } finally {
      setSyncing(false);
    }
  };

  const location = parseLocation(booking.MeetingLocation);
  const questionsAndAnswers = parseQuestionsAndAnswers(booking.QuestionsAndAnswers);

  return (
    <div className={styles.calendlyDetails}>
      {booking.SyncedFromCalendly && (
        <div className={styles.calendlyBadge}>
          📅 Synced from Calendly
        </div>
      )}

      {/* Calendly-specific information */}
      <div className={styles.section}>
        <h3>📋 Calendly Information</h3>
        <div className={styles.detailGrid}>
          {booking.CalendlyEventId && (
            <div className={styles.detailItem}>
              <span className={styles.label}>Calendly Event ID</span>
              <span className={styles.value}>{booking.CalendlyEventId}</span>
            </div>
          )}
          
          {booking.InviteeTimezone && (
            <div className={styles.detailItem}>
              <span className={styles.label}>Invitee Timezone</span>
              <span className={styles.value}>{booking.InviteeTimezone}</span>
            </div>
          )}
          
          {booking.WebhookEvent && (
            <div className={styles.detailItem}>
              <span className={styles.label}>Last Webhook Event</span>
              <span className={styles.value}>{booking.WebhookEvent}</span>
            </div>
          )}

          {booking.EndTime && (
            <div className={styles.detailItem}>
              <span className={styles.label}>Meeting End Time</span>
              <span className={styles.value}>
                {new Date(booking.EndTime).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Meeting Location */}
      {location && (
        <div className={styles.section}>
          <h3>📍 Meeting Location</h3>
          <div className={styles.locationCard}>
            <div className={styles.locationType}>
              Type: {location.type || 'Unknown'}
            </div>
            {location.location && (
              <div className={styles.locationDetails}>
                Location: {location.location}
              </div>
            )}
            {location.join_url && (
              <div className={styles.locationJoin}>
                <a 
                  href={location.join_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.joinButton}
                >
                  🔗 Join Meeting
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meeting Notes */}
      {booking.MeetingNotes && (
        <div className={styles.section}>
          <h3>📝 Meeting Notes</h3>
          <div className={styles.notesCard}>
            {booking.MeetingNotes}
          </div>
        </div>
      )}

      {/* Questions and Answers */}
      {questionsAndAnswers.length > 0 && (
        <div className={styles.section}>
          <h3>❓ Questions & Answers</h3>
          <div className={styles.qaList}>
            {questionsAndAnswers.map((qa: any, index: number) => (
              <div key={index} className={styles.qaItem}>
                <div className={styles.question}>
                  Q{qa.position || index + 1}: {qa.question}
                </div>
                <div className={styles.answer}>
                  A: {qa.answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendly Actions */}
      <div className={styles.section}>
        <h3>🛠️ Calendly Actions</h3>
        <div className={styles.actionGrid}>
          {booking.CalendlyEventURI && (
            <button 
              onClick={handleManualSync}
              disabled={syncing}
              className={styles.syncButton}
            >
              {syncing ? '🔄 Syncing...' : '🔄 Manual Sync'}
            </button>
          )}
          
          {booking.RescheduleUrl && (
            <a 
              href={booking.RescheduleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.actionButton}
            >
              📅 Reschedule
            </a>
          )}
          
          {booking.CancelUrl && (
            <a 
              href={booking.CancelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.cancelButton}
            >
              ❌ Cancel in Calendly
            </a>
          )}
        </div>
        
        {syncStatus && (
          <div className={styles.syncStatus}>
            {syncStatus}
          </div>
        )}
      </div>

      {/* Cancellation Info */}
      {booking.CancellationTime && (
        <div className={styles.section}>
          <h3>🚫 Cancellation Information</h3>
          <div className={styles.cancellationCard}>
            Cancelled on: {new Date(booking.CancellationTime).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
