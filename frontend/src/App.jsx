import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import GlobalChatbot from "./components/GlobalChatbot";
import Home from "./pages/Home";
import Presentation from "./pages/Presentation";
import StaticPage from "./pages/StaticPage";
import LoginRegister from "./pages/loginRegister";
import KPI from "./pages/KPI";
import Plan_action from "./pages/Plan_action";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ThreeD from "./pages/threeD";
import MLPage from "./pages/MLPage";
import Company from "./pages/company";
import Certif from "./pages/certif";
import Products_cable from "./pages/Products_cable";
import Products_Antennas from "./pages/Products_Antennas";
import Service_SupplyChain from "./pages/Service_SupplyChain";
import Service_Policies from "./pages/Service_Policies";
import Service_Assurance from "./pages/Service_Assurance";
import Service_Tech from "./pages/Service_Tech";
import References from "./pages/References";
import Contact_us from "./pages/Contact_us";
import "./App.css";
import "./styles/common.css";

const AUTH_STORAGE_KEY = "kpi-auth-user";
const THEME_STORAGE_KEY = "app-theme";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const readStoredUser = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
};

const readStoredTheme = () => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : "dark";
};

const ProtectedRoute = ({ isAuthenticated, children }) => {
  if (!isAuthenticated) {
    return <Navigate to="/kpi" replace />;
  }

  return children;
};

function App() {
  const [authUser, setAuthUser] = useState(readStoredUser);
  const [theme, setTheme] = useState(readStoredTheme);
  const isAuthenticated = Boolean(authUser);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogin = (user) => {
    setAuthUser(user);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch {
      // Ignore logout API failures and clear local session anyway.
    }

    setAuthUser(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  return (
    <Router>
      <div className="App" data-theme={theme}>
        <Navbar
          authUser={authUser}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
        <Routes>
          <Route path="/" element={<Home theme={theme} />} />
          <Route path="/home" element={<Home theme={theme} />} />
          <Route
            path="/presentation"
            element={<Presentation theme={theme} />}
          />
          <Route path="/company" element={<Company theme={theme} />} />
          <Route path="/certifications" element={<Certif theme={theme} />} />

          <Route
            path="/references"
            element={
              <References theme={theme}  />
            }
          />
          <Route
            path="/contact"
            element={
              <Contact_us theme={theme}  />
            }
          />
          <Route
            path="/products/cable-assembly"
            element={<Products_cable theme={theme} />}
          />
          <Route
            path="/products/automotive-antennas"
            element={
              <Products_Antennas theme={theme} title="Automotive Antennas" />
            }
          />
          <Route
            path="/services/technologies"
            element={
              <Service_Tech theme={theme} />
            }
          />
          <Route
            path="/services/quality-assurance"
            element={
              <Service_Assurance theme={theme} title="Quality Assurance" />
            }
          />
          <Route
            path="/services/quality-policies"
            element={
              
              <Service_Policies theme={theme} title="Quality Policies" />
            }
          />
          <Route
            path="/services/supply-chain"
            element={
              <Service_SupplyChain theme={theme} title="Supply Chain" />
            }
          />
          <Route
            path="/ai-copilot"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                {authUser?.isAdmin ? (
                  <MLPage theme={theme} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/ml-dashboard"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                {authUser?.isAdmin ? (
                  <Navigate to="/ai-copilot" replace />
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/kpi"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginRegister
                  onLogin={handleLogin}
                  theme={theme}
                  onToggleTheme={handleToggleTheme}
                />
              )
            }
          />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <KPI
                  theme={theme}
                  onToggleTheme={handleToggleTheme}
                  authUser={authUser}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan-action"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Plan_action
                  theme={theme}
                  onToggleTheme={handleToggleTheme}
                  authUser={authUser}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan-action/:id"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Plan_action
                  theme={theme}
                  onToggleTheme={handleToggleTheme}
                  authUser={authUser}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                {authUser?.isAdmin ? (
                  <AdminDashboard theme={theme} />
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Profile theme={theme} authUser={authUser} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/threeD"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <ThreeD theme={theme} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <ForgotPassword theme={theme} onToggleTheme={handleToggleTheme} />
            }
          />
          <Route
            path="/reset-password"
            element={
              <ResetPassword theme={theme} onToggleTheme={handleToggleTheme} />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!isAuthenticated && <GlobalChatbot />}
      </div>
    </Router>
  );
}

export default App;
