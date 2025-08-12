// Calendly API service for fetching booking details
import axios from 'axios';

interface CalendlyEventDetails {
  uri: string;
  name: string;
  meeting_notes_plain?: string;
  meeting_notes_html?: string;
  status: 'active' | 'canceled';
  start_time: string;
  end_time: string;
  event_type: string;
  location?: {
    type: string;
    location?: string;
    join_url?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
  event_memberships: Array<{
    user: string;
    user_email: string;
    user_name: string;
  }>;
  event_guests: Array<{
    email: string;
    created_at: string;
    updated_at: string;
  }>;
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  status: 'active' | 'canceled';
  timezone: string;
  created_at: string;
  updated_at: string;
  cancel_url: string;
  reschedule_url: string;
  questions_and_answers: Array<{
    question: string;
    answer: string;
    position: number;
  }>;
  tracking: {
    utm_campaign?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_content?: string;
    utm_term?: string;
    salesforce_uuid?: string;
  };
  text_reminder_number?: string;
  rescheduled: boolean;
  old_invitee?: string;
  new_invitee?: string;
  payment?: {
    external_id: string;
    provider: string;
    amount: number;
    currency: string;
    terms: string;
    successful: boolean;
  };
}

interface CalendlyUser {
  uri: string;
  name: string;
  slug: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  current_organization: string;
}

class CalendlyService {
  private apiKey: string;
  private baseURL = 'https://api.calendly.com';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Get current user info
  async getCurrentUser(): Promise<CalendlyUser> {
    try {
      const response = await axios.get(`${this.baseURL}/users/me`, {
        headers: this.getHeaders()
      });
      return response.data.resource;
    } catch (error) {
      console.error('Error fetching Calendly user:', error);
      throw error;
    }
  }

  // Get event details by URI
  async getEventDetails(eventUri: string): Promise<CalendlyEventDetails> {
    try {
      const response = await axios.get(`${this.baseURL}/scheduled_events/${eventUri}`, {
        headers: this.getHeaders()
      });
      return response.data.resource;
    } catch (error) {
      console.error('Error fetching Calendly event details:', error);
      throw error;
    }
  }

  // Get invitees for an event
  async getEventInvitees(eventUri: string): Promise<CalendlyInvitee[]> {
    try {
      const response = await axios.get(`${this.baseURL}/scheduled_events/${eventUri}/invitees`, {
        headers: this.getHeaders()
      });
      return response.data.collection;
    } catch (error) {
      console.error('Error fetching Calendly invitees:', error);
      throw error;
    }
  }

  // Get user's scheduled events
  async getUserEvents(userUri: string, options?: {
    count?: number;
    page_token?: string;
    sort?: 'start_time:asc' | 'start_time:desc';
    status?: 'active' | 'canceled';
    min_start_time?: string; // ISO 8601 format
    max_start_time?: string; // ISO 8601 format
  }): Promise<{ collection: CalendlyEventDetails[]; pagination: any }> {
    try {
      const params = new URLSearchParams();
      params.append('user', userUri);
      
      if (options?.count) params.append('count', options.count.toString());
      if (options?.page_token) params.append('page_token', options.page_token);
      if (options?.sort) params.append('sort', options.sort);
      if (options?.status) params.append('status', options.status);
      if (options?.min_start_time) params.append('min_start_time', options.min_start_time);
      if (options?.max_start_time) params.append('max_start_time', options.max_start_time);

      const response = await axios.get(`${this.baseURL}/scheduled_events?${params}`, {
        headers: this.getHeaders()
      });
      
      return {
        collection: response.data.collection,
        pagination: response.data.pagination
      };
    } catch (error) {
      console.error('Error fetching user events:', error);
      throw error;
    }
  }

  // Get organization events (for all users in organization)
  async getOrganizationEvents(organizationUri: string, options?: {
    count?: number;
    page_token?: string;
    sort?: 'start_time:asc' | 'start_time:desc';
    status?: 'active' | 'canceled';
    min_start_time?: string;
    max_start_time?: string;
  }): Promise<{ collection: CalendlyEventDetails[]; pagination: any }> {
    try {
      const params = new URLSearchParams();
      params.append('organization', organizationUri);
      
      if (options?.count) params.append('count', options.count.toString());
      if (options?.page_token) params.append('page_token', options.page_token);
      if (options?.sort) params.append('sort', options.sort);
      if (options?.status) params.append('status', options.status);
      if (options?.min_start_time) params.append('min_start_time', options.min_start_time);
      if (options?.max_start_time) params.append('max_start_time', options.max_start_time);

      const response = await axios.get(`${this.baseURL}/scheduled_events?${params}`, {
        headers: this.getHeaders()
      });
      
      return {
        collection: response.data.collection,
        pagination: response.data.pagination
      };
    } catch (error) {
      console.error('Error fetching organization events:', error);
      throw error;
    }
  }

  // Cancel an event
  async cancelEvent(eventUri: string, reason?: string): Promise<CalendlyEventDetails> {
    try {
      const response = await axios.post(`${this.baseURL}/scheduled_events/${eventUri}/cancellation`, {
        reason: reason || 'Event canceled'
      }, {
        headers: this.getHeaders()
      });
      return response.data.resource;
    } catch (error) {
      console.error('Error canceling Calendly event:', error);
      throw error;
    }
  }

  // Get event type details
  async getEventType(eventTypeUri: string) {
    try {
      const response = await axios.get(`${this.baseURL}/event_types/${eventTypeUri}`, {
        headers: this.getHeaders()
      });
      return response.data.resource;
    } catch (error) {
      console.error('Error fetching event type:', error);
      throw error;
    }
  }

  // Convert Calendly event to your booking format
  convertToBookingFormat(event: CalendlyEventDetails, invitees: CalendlyInvitee[], organizerInfo: any) {
    const primaryInvitee = invitees[0]; // Assuming single invitee for now
    
    return {
      CalendlyEventURI: event.uri,
      CalendlyEventId: this.extractIdFromUri(event.uri),
      BookingStatus: event.status === 'active' ? 'Scheduled' : 'Cancelled',
      MeetingTime: event.start_time,
      EndTime: event.end_time,
      InviteeEmail: primaryInvitee?.email,
      InviteeName: primaryInvitee?.name,
      InviteeTimezone: primaryInvitee?.timezone,
      OrganizerEmail: organizerInfo.email,
      OrganizerName: organizerInfo.name,
      MeetingLocation: event.location,
      MeetingNotes: event.meeting_notes_plain,
      CancelUrl: primaryInvitee?.cancel_url,
      RescheduleUrl: primaryInvitee?.reschedule_url,
      CreatedAt: event.created_at,
      UpdatedAt: event.updated_at,
      QuestionsAndAnswers: primaryInvitee?.questions_and_answers || []
    };
  }

  private extractIdFromUri(uri: string): string {
    return uri.split('/').pop() || '';
  }
}

export { CalendlyService, type CalendlyEventDetails, type CalendlyInvitee, type CalendlyUser };
