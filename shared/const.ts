export const COOKIE_NAME = "app_session_id";
// Security fix (C-19): session duration reduced from 1 year to 24 hours.
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24; // 24 hours
// Session rotation window (AD-11): if a session was issued more than this
// threshold ago, issue a fresh cookie on the next authenticated request.
export const SESSION_ROTATION_THRESHOLD_MS = 1000 * 60 * 60; // 1 hour
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
