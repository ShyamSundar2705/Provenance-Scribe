import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuthStore } from "../store/auth.store";

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
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">{fullName}</p>
          {specialisation && <p className="text-sm text-slate-500">{specialisation}</p>}
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Log out
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Consultations</h1>
          <button
            onClick={() => setShowNewForm(true)}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            New consultation
          </button>
        </div>

        {loadError && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {consultations === null && !loadError && (
          <p className="text-sm text-slate-500">Loading...</p>
        )}

        {consultations !== null && consultations.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No consultations yet. Start one with "New consultation".
          </div>
        )}

        {consultations !== null && consultations.length > 0 && (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {consultations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/consultations/${c.id}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{c.patient_name}</p>
                    <p className="text-xs text-slate-500">
                      {c.patient_age} · {c.patient_gender}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs font-medium uppercase text-slate-400">{c.status}</p>
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[420px] rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">New consultation</h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Patient name
            </label>
            <input
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Age</label>
            <input
              type="number"
              required
              min={0}
              max={120}
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
            <select
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
