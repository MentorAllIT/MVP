export async function register() {
  // Only run cron jobs in production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    const { initializeCronJobs } = await import('./src/lib/cron-scheduler');
    initializeCronJobs();
  }
}
