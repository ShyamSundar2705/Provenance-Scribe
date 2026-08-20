import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPlaceholder } from "./pages/DashboardPlaceholder";
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPlaceholder />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
