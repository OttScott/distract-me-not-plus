// Security constants
export const BCRYPT_SALT_ROUNDS = 10;

// Storage constants
export const SYNC_STORAGE_MAX_SIZE = 100 * 1024; // 100KB Chrome sync storage limit

// Regex validation
export const MAX_REGEX_LENGTH = 10000; // Maximum allowed regex pattern length

// Timer defaults (in minutes)
export const DEFAULT_TIMER_DURATION = 5;
export const MAX_TIMER_DURATION = 1440; // 24 hours

// Sync polling
export const SYNC_POLL_MAX_ATTEMPTS = 6;
export const SYNC_POLL_INTERVAL_MS = 10000; // 10 seconds
export const SYNC_POLL_TIMEOUT_MS = 60000; // 60 seconds total
