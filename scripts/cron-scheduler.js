#!/usr/bin/env node

// Standalone cron job runner for booking status updates
// This can be run as a separate process or deployed as a serverless function

require('dotenv').config();
const cron = require('node-cron');

async function runDailyUpdate() {
  console.log('Running daily booking status update...');
  
  try {
    // Dynamic import for ES module
    const fetch = (await import('node-fetch')).default;
    
    const cronSecret = process.env.CRON_SECRET || 'default-secret';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/bookings/daily-status-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Daily status update completed successfully:', result);
    } else {
      console.error('Daily status update failed:', result);
    }
  } catch (error) {
    console.error('Error running daily status update:', error);
  }
}

// Schedule daily at 9:00 AM AEST
console.log('Starting cron scheduler for booking status updates...');
console.log('Scheduled to run daily at 9:00 AM AEST');

cron.schedule('0 9 * * *', runDailyUpdate, {
  timezone: "Australia/Sydney"
});

// Keep the process running
process.on('SIGINT', () => {
  console.log('Shutting down cron scheduler...');
  process.exit(0);
});

// Optional: Run immediately for testing
if (process.argv.includes('--run-now')) {
  console.log('Running immediately for testing...');
  runDailyUpdate();
}
