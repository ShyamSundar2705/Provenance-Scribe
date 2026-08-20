import axios from "axios";
import { useAuthStore } from "./store/auth.store";

const AUTH_STORAGE_KEY = "provenance-auth";

export const api = axios.create({
  baseURL: "http://localhost:8000",
});

export function getToken(): string | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTH_ENDPOINTS = ["/api/v1/auth/login", "/api/v1/auth/register"];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? "";
    const isAuthAttempt = AUTH_ENDPOINTS.some((path) => url.includes(path));
    if (error.response?.status === 401 && !isAuthAttempt) {
      useAuthStore.getState().clearAuth();
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
