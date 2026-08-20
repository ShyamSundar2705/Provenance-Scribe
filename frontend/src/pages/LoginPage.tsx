import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuthStore } from "../store/auth.store";

type Tab = "signin" | "register";

interface TokenResponse {
  access_token: string;
  token_type: string;
  doctor_id: string;
  full_name: string;
  email: string;
  specialisation: string | null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [tab, setTab] = useState<Tab>("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  const [regDoctorId, setRegDoctorId] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regSpecialisation, setRegSpecialisation] = useState("");
  const [regPassword, setRegPassword] = useState("");

  function applyAuth(data: TokenResponse) {
    setAuth({
      token: data.access_token,
      doctorId: data.doctor_id,
      fullName: data.full_name,
      email: data.email,
      specialisation: data.specialisation,
    });
    navigate("/", { replace: true });
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = new URLSearchParams();
      body.set("username", signinEmail);
      body.set("password", signinPassword);
      const res = await api.post<TokenResponse>("/api/v1/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      applyAuth(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError("Incorrect email or password.");
      } else {
        setError("Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<TokenResponse>("/api/v1/auth/register", {
        doctor_id: regDoctorId,
        email: regEmail,
        full_name: regFullName,
        specialisation: regSpecialisation || null,
        password: regPassword,
      });
      applyAuth(res.data);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError("A doctor with this email or doctor ID already exists.");
      } else {
        setError("Registration failed. Please check your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[420px] rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-xl font-semibold text-slate-900">
          Provenance Scribe
        </h1>

        <div className="mb-6 flex rounded-md bg-slate-100 p-1">
          <button
            type="button"
            className={`flex-1 rounded-sm py-2 text-sm font-medium transition-colors ${
              tab === "signin" ? "bg-white text-slate-900 shadow" : "text-slate-500"
            }`}
            onClick={() => {
              setTab("signin");
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-sm py-2 text-sm font-medium transition-colors ${
              tab === "register" ? "bg-white text-slate-900 shadow" : "text-slate-500"
            }`}
            onClick={() => {
              setTab("register");
              setError(null);
            }}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {tab === "signin" ? (
          <form className="space-y-4" onSubmit={handleSignIn}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                required
                value={signinEmail}
                onChange={(e) => setSigninEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                required
                value={signinPassword}
                onChange={(e) => setSigninPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Doctor ID
              </label>
              <input
                type="text"
                required
                placeholder="DR-001"
                value={regDoctorId}
                onChange={(e) => setRegDoctorId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Full name
              </label>
              <input
                type="text"
                required
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Specialisation (optional)
              </label>
              <input
                type="text"
                value={regSpecialisation}
                onChange={(e) => setRegSpecialisation(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Registering..." : "Register"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
