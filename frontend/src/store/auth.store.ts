import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthState {
  token: string | null;
  doctorId: string | null;
  fullName: string | null;
  email: string | null;
  specialisation: string | null;
  setAuth: (payload: {
    token: string;
    doctorId: string;
    fullName: string;
    email: string;
    specialisation: string | null;
  }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      doctorId: null,
      fullName: null,
      email: null,
      specialisation: null,
      setAuth: (payload) =>
        set({
          token: payload.token,
          doctorId: payload.doctorId,
          fullName: payload.fullName,
          email: payload.email,
          specialisation: payload.specialisation,
        }),
      clearAuth: () =>
        set({
          token: null,
          doctorId: null,
          fullName: null,
          email: null,
          specialisation: null,
        }),
    }),
    { name: "provenance-auth" }
  )
);
