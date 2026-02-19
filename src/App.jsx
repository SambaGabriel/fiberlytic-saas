import { useState, useEffect, useCallback } from "react";
import FiberlyticApp from "./FiberlyticApp.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import api from "./services/api.js";

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // On mount, check for existing session
  useEffect(() => {
    const stored = api.getStoredUser();
    if (stored && api.isAuthenticated()) {
      setAuthUser(stored);
    }
    setChecking(false);
  }, []);

  // Listen for forced logout (token expired, etc.)
  useEffect(() => {
    const handleLogout = () => {
      setAuthUser(null);
    };
    window.addEventListener("fl:auth:logout", handleLogout);
    return () => window.removeEventListener("fl:auth:logout", handleLogout);
  }, []);

  const handleLogin = useCallback((user) => {
    setAuthUser(user);
  }, []);

  const handleLogout = useCallback(async () => {
    await api.logout();
    setAuthUser(null);
  }, []);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
          color: "#888888",
          fontFamily: "'Instrument Sans',system-ui,sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <FiberlyticApp authUser={authUser} onLogout={handleLogout} />;
}

export default App;
