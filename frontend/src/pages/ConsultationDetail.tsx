import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

interface ConsultationDetailData {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  status: string;
  created_at: string;
  updated_at: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error" }
  | { kind: "loaded"; data: ConsultationDetailData };

export function ConsultationDetail() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    api
      .get<ConsultationDetailData>(`/api/v1/consultations/${id}`)
      .then((res) => {
        if (!cancelled) setState({ kind: "loaded", data: res.data });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setState({ kind: "not_found" });
        } else {
          setState({ kind: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-900">Consultation not found</p>
          <Link to="/" className="mt-4 inline-block text-sm text-slate-600 underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-medium text-red-700">Failed to load consultation</p>
          <Link to="/" className="mt-4 inline-block text-sm text-slate-600 underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { data } = state;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link to="/" className="text-sm text-slate-600 underline">
          ← Back to dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="mb-4 text-xl font-semibold text-slate-900">{data.patient_name}</h1>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Age</dt>
              <dd className="font-medium text-slate-900">{data.patient_age}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Gender</dt>
              <dd className="font-medium capitalize text-slate-900">{data.patient_gender}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium uppercase text-slate-900">{data.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="font-medium text-slate-900">
                {new Date(data.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No transcript yet
        </div>
      </main>
    </div>
  );
}
