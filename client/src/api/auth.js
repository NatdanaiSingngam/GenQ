import api from "./client";

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

// Get Google login URL (redirect user there)
export function getGoogleLoginUrl() {
  return `${BASE_URL}/auth/google`;
}

// Check current user from JWT
export async function getMe() {
  const token = localStorage.getItem("genq_token");
  if (!token) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data?.user) return data.user;
  } catch {}

  // Token invalid — clear it
  localStorage.removeItem("genq_token");
  return null;
}

// Store token from URL query param (after Google callback)
export function handleLoginCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    localStorage.setItem("genq_token", token);
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
    return true;
  }
  return false;
}

// Logout
export function logout() {
  localStorage.removeItem("genq_token");
  // Also try server-side logout (best-effort)
  fetch(`${BASE_URL}/auth/logout`, { method: "POST" }).catch(() => {});
}

// Get auth headers
export function getAuthHeaders() {
  const token = localStorage.getItem("genq_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
