import * as crypto from 'crypto';

// Generate a secure random token
export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash the reset token for storage
export const hashResetToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate expiration timestamp (1 hour from now)
export const generateTokenExpiry = (): string => {
  const expiryTime = new Date();
  expiryTime.setHours(expiryTime.getHours() + 1);
  // For Airtable Date fields (without time), send only the date part
  return expiryTime.toISOString().split('T')[0];
};

// Check if token is expired
export const isTokenExpired = (expiryTime: string): boolean => {
  // Handle both ISO strings and date-only strings
  let expiry: Date;
  if (expiryTime.includes('T')) {
    // ISO string with time
    expiry = new Date(expiryTime);
  } else {
    // Date-only string (Airtable Date field) - add time to make it end of day
    expiry = new Date(expiryTime + 'T23:59:59.999Z');
  }
  const now = new Date();
  return now > expiry;
};

// Validate token format (basic validation)
export const isValidTokenFormat = (token: string): boolean => {
  // Token should be 64 characters (32 bytes as hex)
  return /^[a-f0-9]{64}$/.test(token);
};

// Generate a user-friendly reset code (6 digits)
export const generateResetCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate reset code format
export const isValidResetCode = (code: string): boolean => {
  return /^\d{6}$/.test(code);
};
