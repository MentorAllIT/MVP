import { useState, useEffect } from 'react';
import styles from './BookingForm.module.css';

interface User {
  UserID: string;
  Name: string;
  Email: string;
  Role: string;
}

interface BookingFormProps {
  currentUserId?: string; // Current logged-in user's ID
  preselectedMentorId?: string; // Pre-selected mentor ID
}

export default function BookingForm({ currentUserId, preselectedMentorId }: BookingFormProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    inviteeId: preselectedMentorId || '',
    meetingDate: '',
    meetingTime: '',
  });

  // Load available users when component mounts
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users'); // We'll need to create this endpoint
      if (response.ok) {
        const data = await response.json();
        // Filter out current user from the list
        const availableUsers = data.users.filter((user: User) => user.UserID !== currentUserId);
        setUsers(availableUsers);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      setError('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUserId) {
      setError('User not logged in');
      return;
    }

    if (!formData.inviteeId || !formData.meetingDate || !formData.meetingTime) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Combine date and time into ISO string
      const meetingDateTime = new Date(`${formData.meetingDate}T${formData.meetingTime}`);
      
      if (meetingDateTime <= new Date()) {
        setError('Meeting time must be in the future');
        return;
      }

      const bookingPayload = {
        bookerId: currentUserId,
        inviteeId: formData.inviteeId,
        meetingTime: meetingDateTime.toISOString(),
      };

      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingPayload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Booking created successfully! Booking ID: ${data.bookingId}`);
        // Reset form
        setFormData({
          inviteeId: '',
          meetingDate: '',
          meetingTime: '',
        });
      } else {
        setError(data.error || 'Failed to create booking');
      }
    } catch (err) {
      setError('Error creating booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2>Create New Booking</h2>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Invitee Selection */}
        <div className={styles.formGroup}>
          <label htmlFor="inviteeId">Select Person to Invite:</label>
          <select
            id="inviteeId"
            name="inviteeId"
            value={formData.inviteeId}
            onChange={handleInputChange}
            required
            className={styles.select}
            disabled={!!preselectedMentorId} // Disable if mentor is preselected
          >
            <option value="">-- Choose a person --</option>
            {users.map((user) => (
              <option key={user.UserID} value={user.UserID}>
                {user.Name} ({user.Email}) - {user.Role}
              </option>
            ))}
          </select>
          {preselectedMentorId && (
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Mentor has been pre-selected for you
            </div>
          )}
        </div>

        {/* Meeting Date */}
        <div className={styles.formGroup}>
          <label htmlFor="meetingDate">Meeting Date:</label>
          <input
            type="date"
            id="meetingDate"
            name="meetingDate"
            value={formData.meetingDate}
            onChange={handleInputChange}
            min={new Date().toISOString().split('T')[0]} // Prevent past dates
            required
            className={styles.input}
          />
        </div>

        {/* Meeting Time */}
        <div className={styles.formGroup}>
          <label htmlFor="meetingTime">Meeting Time:</label>
          <input
            type="time"
            id="meetingTime"
            name="meetingTime"
            value={formData.meetingTime}
            onChange={handleInputChange}
            required
            className={styles.input}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={styles.submitButton}
        >
          {loading ? 'Creating Booking...' : 'Create Booking'}
        </button>
      </form>

      {/* Messages */}
      {error && (
        <div className={styles.error}>
          <p>❌ {error}</p>
        </div>
      )}
      
      {success && (
        <div className={styles.success}>
          <p>✅ {success}</p>
        </div>
      )}

      {/* Loading state for users */}
      {loading && users.length === 0 && (
        <div className={styles.loading}>
          <p>Loading users...</p>
        </div>
      )}
    </div>
  );
}
