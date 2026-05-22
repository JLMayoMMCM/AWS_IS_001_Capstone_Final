// In-memory login rate limiter (FR-AUTH-09, NFR-SEC-10).
//
// After 5 failed attempts within 10 minutes for the same email, further
// attempts are locked for 15 minutes.
//
// NOTE: this state is per-process. A multi-instance deployment should move it
// to a shared store (e.g. Redis or a `login_attempts` table). It is adequate
// for the prototype and single-instance hosting.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOCK_MS = 15 * 60 * 1000; // 15 minutes

interface Attempt {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}

const attempts = new Map<string, Attempt>();

function key(email: string): string {
  return email.trim().toLowerCase();
}

/** Checks whether a login attempt is currently allowed for this email. */
export function checkLoginRateLimit(email: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const record = attempts.get(key(email));
  if (record?.lockedUntil && record.lockedUntil > Date.now()) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((record.lockedUntil - Date.now()) / 1000),
    };
  }
  return { allowed: true };
}

/** Records a failed attempt; locks the email once the threshold is reached. */
export function recordFailedLogin(email: string): void {
  const k = key(email);
  const now = Date.now();
  const record = attempts.get(k);

  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(k, { count: 1, firstAt: now });
    return;
  }

  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCK_MS;
  }
}

/** Clears the attempt record after a successful login. */
export function clearLoginAttempts(email: string): void {
  attempts.delete(key(email));
}
