const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  // allow absolute URLs or path starting with /api
  const token = localStorage.getItem("evidence_locker_token");
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // ensure content-type not overwritten unless provided
  const finalInit: RequestInit = { ...init, headers };

  // Normalize URL: if input is relative path starting with /api, prepend API_BASE
  let url = typeof input === 'string' ? input : (input as Request).url;
  if (typeof input === 'string' && input.startsWith('/api')) {
    url = `${API_BASE}${input}`;
  }

  return fetch(url, finalInit);
}

export { API_BASE, authFetch };
