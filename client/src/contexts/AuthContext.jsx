import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe, handleLoginCallback, logout as apiLogout, getGoogleLoginUrl } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check login callback on mount
  useEffect(() => {
    const hasToken = handleLoginCallback();
    if (hasToken) {
      getMe().then((u) => {
        setUser(u);
        setLoading(false);
      });
    } else {
      getMe().then((u) => {
        setUser(u);
        setLoading(false);
      });
    }
  }, []);

  const login = useCallback(() => {
    window.location.href = getGoogleLoginUrl();
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
