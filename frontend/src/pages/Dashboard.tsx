import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuthStore } from "../store/auth.store";
import { AppHeader, StatusBadge, genderLabel } from "../components/ui";

interface ConsultationListItem {
  id: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  status: string;
  created_at: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const fullName = useAuthStore((state) => state.fullName);
  const specialisation = useAuthStore((state) => state.specialisation);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [consultations, setConsultations] = useState<ConsultationListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  async function loadConsultations() {
    try {
      const res = await api.get<ConsultationListItem[]>("/api/v1/consultations/");
      setConsultations(res.data);
    } catch {
      setLoadError("Failed to load consultations.");
    }
  }

  useEffect(() => {
    loadConsultations();
  }, []);

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <AppHeader>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-ink">{fullName}</p>
          {specialisation && <p className="text-xs text-muted">{specialisation}</p>}
        </div>
        <button onClick={handleLogout} className="btn btn-secondary py-1.5">
          Log out
        </button>
      </AppHeader>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink">
              Consultations
            </h1>
            <p className="mt-1 text-sm text-muted sm:hidden">{fullName}</p>
          </div>
          <button onClick={() => setShowNewForm(true)} className="btn btn-primary">
            New consultation
          </button>
        </div>

        {loadError && <div className="error-note mb-4">{loadError}</div>}

        {consultations === null && !loadError && <p className="text-sm text-muted">Loading...</p>}

        {consultations !== null && consultations.length === 0 && (
          <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-14 text-center">
            <p className="font-serif text-xl font-semibold text-ink">No consultations yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Start with a patient's details, record their consent, then paste a consultation
              transcript to generate and check a note.
            </p>
            <button onClick={() => setShowNewForm(true)} className="btn btn-primary mt-5">
              New consultation
            </button>
          </div>
        )}

        {consultations !== null && consultations.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {consultations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/consultations/${c.id}`)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-paper"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg font-semibold text-ink">
                      {c.patient_name}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {c.patient_age} years, {genderLabel(c.patient_gender).toLowerCase()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={c.status} />
                    <p className="text-xs text-muted">
                      {new Date(c.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showNewForm && (
        <NewConsultationModal
          onClose={() => setShowNewForm(false)}
          onCreated={(id) => navigate(`/consultations/${id}`)}
        />
      )}
    </div>
  );
}

function NewConsultationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("male");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/api/v1/consultations/", {
        patient_name: patientName,
        patient_age: Number(patientAge),
        patient_gender: patientGender,
      });
      onCreated(res.data.id);
    } catch (err: any) {
      if (err.response?.status === 422) {
        setError("Please check the patient details — age must be 0-120.");
      } else {
        setError("Failed to create consultation. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-ink/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-consultation-title"
    >
      <div className="w-full max-w-[420px] rounded-lg bg-surface p-6 shadow-xl">
        <h2 id="new-consultation-title" className="mb-4 font-serif text-xl font-semibold text-ink">
          New consultation
        </h2>

        {error && <div className="error-note mb-4">{error}</div>}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="patient-name" className="field-label">
              Patient name
            </label>
            <input
              id="patient-name"
              type="text"
              required
              autoFocus
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="patient-age" className="field-label">
              Age
            </label>
            <input
              id="patient-age"
              type="number"
              required
              min={0}
              max={120}
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="patient-gender" className="field-label">
              Gender
            </label>
            <select
              id="patient-gender"
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value)}
              className="field"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
