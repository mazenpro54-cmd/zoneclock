import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import LoginPage from "./pages/LoginPage";
import ClockPage from "./pages/ClockPage";
import TimesheetPage from "./pages/TimesheetPage";
import ShiftsPage from "./pages/ShiftsPage";
import TeamsPage from "./pages/TeamsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ClientsPage from "./pages/ClientsPage";
import KanbanPage from "./pages/KanbanPage";
import TimeOffPage from "./pages/TimeOffPage";
import PayrollPage from "./pages/PayrollPage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import Navbar from "./components/Navbar";
import { Clock } from "lucide-react";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page-loader full-screen">
        <Clock size={40} className="spin" />
        <p>Loading ZoneClock…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-brand">
          <Clock size={22} className="brand-icon" />
          <span>ZoneClock</span>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ClockPage />} />
          <Route path="/timesheet" element={<TimesheetPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/timeoff" element={<TimeOffPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Navbar />
    </div>
  );
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page-loader full-screen">
        <Clock size={40} className="spin" />
        <p>Loading ZoneClock…</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const isNative =
    typeof window !== "undefined" &&
    (Capacitor.isNativePlatform() ||
      window.location.protocol === "capacitor:" ||
      window.location.protocol === "file:" ||
      (window.location.hostname === "localhost" && window.location.port === "") ||
      window.location.pathname.endsWith(".html") ||
      window.location.hostname.endsWith("github.io"));

  const RouterComponent = isNative ? HashRouter : BrowserRouter;

  return (
    <AuthProvider>
      <SettingsProvider>
        <RouterComponent>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/*" element={<RequireAuth><AppLayout /></RequireAuth>} />
          </Routes>
        </RouterComponent>
      </SettingsProvider>
    </AuthProvider>
  );
}
