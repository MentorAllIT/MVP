// Integration tests for booking API with actual server
// Run these tests with the Next.js development server running (npm run dev)

// Test data - these should be actual UserIDs that exist in your Airtable
const testUser = { UserID: 'lqweeee' }; // Make sure this user exists in your Users table
const testInvitee = { UserID: 'OTE0t0r4Qb' }; // Make sure this user exists in your Users table

// Test configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

// Helper function to make API requests to the running server
async function apiRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });
    
    let data;
    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }
    
    return {
        status: response.status,
        statusText: response.statusText,
        data,
        ok: response.ok,
    };
}

describe('Booking API Server Integration Tests', () => {
    const createdBookingIds: string[] = [];
    let serverRunning = false;

    beforeAll(async () => {
        // Test if server is running by making a simple request
        try {
            const response = await fetch(`${API_BASE_URL}/api/booking?userId=test`);
            serverRunning = true;
            console.log('✅ Server is running and accessible');
        } catch (error) {
            console.warn('⚠️  Server is not running. Start with: npm run dev');
            console.warn('These tests require the Next.js development server to be running');
        }
    });

    afterAll(async () => {
        if (createdBookingIds.length > 0) {
            console.log('📝 Test bookings created:', createdBookingIds);
            console.log('💡 You may want to clean these up from your Airtable manually');
        }
    });

    it.only('should create a booking via API endpoint', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
        
        const bookingPayload = {
            bookerId: testUser.UserID,
            inviteeId: testInvitee.UserID,
            meetingTime: futureDate.toISOString()
        };

        const { status, data, ok } = await apiRequest('/api/booking', {
            method: 'POST',
            body: JSON.stringify(bookingPayload),
        });

        console.log('📊 Response status:', status);
        console.log('📋 Response data:', JSON.stringify(data, null, 2));

        expect(status).toBe(201);
        expect(ok).toBe(true);
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('bookingId');
        expect(data.booking.bookerId).toBe(testUser.UserID);
        expect(data.booking.inviteeId).toBe(testInvitee.UserID);
        expect(data.booking.status).toBe('Pending');
        
        // Store booking ID for reference
        if (data.bookingId) {
            createdBookingIds.push(data.bookingId);
        }
    });

    it('should return 400 for missing required fields', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const incompletePayload = {
            bookerId: testUser.UserID,
            // Missing inviteeId and meetingTime
        };

        const { status, data, ok } = await apiRequest('/api/booking', {
            method: 'POST',
            body: JSON.stringify(incompletePayload),
        });

        expect(status).toBe(400);
        expect(ok).toBe(false);
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('Missing required fields');
    });

    it('should return 400 for past meeting time', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1); // Yesterday
        
        const bookingPayload = {
            bookerId: testUser.UserID,
            inviteeId: testInvitee.UserID,
            meetingTime: pastDate.toISOString()
        };

        const { status, data, ok } = await apiRequest('/api/booking', {
            method: 'POST',
            body: JSON.stringify(bookingPayload),
        });

        expect(status).toBe(400);
        expect(ok).toBe(false);
        expect(data.error).toBe('Meeting time must be in the future');
    });

    it('should return 400 when booking with yourself', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        
        const selfBookingPayload = {
            bookerId: testUser.UserID,
            inviteeId: testUser.UserID, // Same as booker
            meetingTime: futureDate.toISOString()
        };

        const { status, data, ok } = await apiRequest('/api/booking', {
            method: 'POST',
            body: JSON.stringify(selfBookingPayload),
        });

        expect(status).toBe(400);
        expect(ok).toBe(false);
        expect(data.error).toBe('Cannot book a meeting with yourself');
    });

    it('should return 404 for non-existent booker', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        
        const invalidBookerPayload = {
            bookerId: 'nonexistent123',
            inviteeId: testInvitee.UserID,
            meetingTime: futureDate.toISOString()
        };

        const { status, data, ok } = await apiRequest('/api/booking', {
            method: 'POST',
            body: JSON.stringify(invalidBookerPayload),
        });

        expect(status).toBe(404);
        expect(ok).toBe(false);
        expect(data.error).toBe('Booker not found');
    });

    it('should return 404 for non-existent invitee', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        
        const invalidInviteePayload = {
            bookerId: testUser.UserID,
            inviteeId: 'nonexistent456',
            meetingTime: futureDate.toISOString()
        };

        const { status, data, ok } = await apiRequest('/api/booking', {
            method: 'POST',
            body: JSON.stringify(invalidInviteePayload),
        });

        expect(status).toBe(404);
        expect(ok).toBe(false);
        expect(data.error).toBe('Invitee not found');
    });

    it('should fetch bookings for a user via GET endpoint', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const { status, data, ok } = await apiRequest(`/api/booking?userId=${testUser.UserID}`, {
            method: 'GET',
        });

        expect(status).toBe(200);
        expect(ok).toBe(true);
        expect(data).toHaveProperty('success', true);
        expect(Array.isArray(data.bookings)).toBe(true);
        
        // If there are bookings, check the structure
        if (data.bookings.length > 0) {
            const booking = data.bookings[0];
            expect(booking).toHaveProperty('BookingID');
            expect(booking).toHaveProperty('BookedByUserID');
            expect(booking).toHaveProperty('InvitedID');
            expect(booking).toHaveProperty('MeetingTime');
            expect(booking).toHaveProperty('BookingStatus');
        }
    });

    it('should return 400 when fetching bookings without userId parameter', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const { status, data, ok } = await apiRequest('/api/booking', {
            method: 'GET',
        });

        expect(status).toBe(400);
        expect(ok).toBe(false);
        expect(data.error).toBe('userId parameter is required');
    });

    it('should handle invalid JSON gracefully', async () => {
        if (!serverRunning) {
            console.warn('⚠️  Skipping test: Server not running');
            return;
        }

        const { status, ok } = await apiRequest('/api/booking', {
            method: 'POST',
            body: 'invalid json{',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        expect(status).toBe(500);
        expect(ok).toBe(false);
    });
});