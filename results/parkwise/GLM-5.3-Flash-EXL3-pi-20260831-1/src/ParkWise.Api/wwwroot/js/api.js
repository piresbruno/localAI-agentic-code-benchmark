/**
 * Typed fetch wrapper over the ParkWise API. Every failure is normalized to
 * the API error contract: `{ code, message, details? }` — the UI never parses raw JSON.
 */
const TOKEN_KEY = 'parkwise.token';

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

async function request(path, options = {}) {
  const headers = { 'content-type': 'application/json' };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw { code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.' };
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw body?.error ?? { code: 'INTERNAL', message: 'Unexpected server error.' };
  return body;
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  registerEntry: (plate, vehicleType) =>
    request('/api/entries', { method: 'POST', body: JSON.stringify({ plate, vehicleType }) }),
  tickets: (status) => request(`/api/tickets?status=${encodeURIComponent(status)}`),
  exit: (ticketId) => request(`/api/exits/${ticketId}`, { method: 'POST' }),
  pay: (ticketId, method) =>
    request('/api/payments', { method: 'POST', body: JSON.stringify({ ticketId, method }) }),
  markLost: (ticketId) => request(`/api/tickets/${ticketId}/lost`, { method: 'POST' }),
  occupancy: () => request('/api/admin/occupancy'),
};

/** First field-level message from an error contract's details, if any. */
export function fieldError(err, field) {
  const issues = err?.details?.issues;
  return Array.isArray(issues) ? issues.find((i) => i.field === field)?.message : undefined;
}
