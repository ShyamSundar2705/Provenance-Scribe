import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";

export function DashboardPlaceholder() {
  const navigate = useNavigate();
  const fullName = useAuthStore((state) => state.fullName);
  const doctorId = useAuthStore((state) => state.doctorId);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <p className="text-lg text-slate-800">
          Logged in as {fullName} ({doctorId})
        </p>
        <button
          onClick={handleLogout}
          className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
