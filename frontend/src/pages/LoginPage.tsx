import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuthStore } from "../store/auth.store";
import { TierIcon, Wordmark } from "../components/ui";

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
    <div className="grid min-h-screen md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <aside className="flex flex-col justify-between bg-primary px-6 py-8 text-white sm:px-12 sm:py-12">
        <Wordmark className="text-[32px] sm:text-[44px] sm:leading-none" />
        <div className="my-10 max-w-lg md:my-0">
          <p className="font-serif text-2xl leading-snug sm:text-[28px]">
            Every safety-critical fact in the note, traced back to what was said.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/85">
            Provenance Scribe checks a fixed set of facts in a generated note (medications and
            doses, allergies, symptoms, vitals) against the consultation transcript and shows
            you what to confirm. It highlights; the clinician decides.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              ["verified", "Verified", "The transcript explicitly supports the fact."],
              ["requires_confirmation", "Requires confirmation", "The note states it; the transcript does not."],
              ["potential_conflict", "Potential conflict", "The note contradicts the transcript."],
            ].map(([tier, label, text]) => (
              <li key={tier} className="flex gap-3">
                <TierIcon tier={tier} className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold">{label}.</span>{" "}
                  <span className="text-white/85">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-white/70 md:block">
          Under development. Not a deployed or evaluated clinical system.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex gap-6 border-b border-line" role="tablist">
            {(["signin", "register"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`-mb-px border-b-2 pb-2 text-sm font-medium ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-ink"
                }`}
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
              >
                {t === "signin" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          {error && <div className="error-note mb-4">{error}</div>}

          {tab === "signin" ? (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label htmlFor="signin-email" className="field-label">
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="signin-password" className="field-label">
                  Password
                </label>
                <input
                  id="signin-password"
                  type="password"
                  required
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  className="field"
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div>
                <label htmlFor="reg-doctor-id" className="field-label">
                  Doctor ID
                </label>
                <input
                  id="reg-doctor-id"
                  type="text"
                  required
                  placeholder="DR-001"
                  value={regDoctorId}
                  onChange={(e) => setRegDoctorId(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="reg-name" className="field-label">
                  Full name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="reg-spec" className="field-label">
                  Specialisation (optional)
                </label>
                <input
                  id="reg-spec"
                  type="text"
                  value={regSpecialisation}
                  onChange={(e) => setRegSpecialisation(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="field-label">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="field-label">
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="field"
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? "Registering..." : "Register"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
