import { useNavigate, useLocation } from "react-router-dom";
import { Brain, History, LogIn, LogOut, User, Sun, Moon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, login, logout, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-40 bg-primary/80 backdrop-blur-xl border-b border-surface/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-heading tracking-tight">
            Gen<span className="text-indigo-400">Q</span>
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              location.pathname === "/history"
                ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                : "text-body hover:text-heading hover:bg-surface border border-transparent"
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">ประวัติ</span>
          </button>

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="p-2 text-body hover:text-heading hover:bg-surface rounded-xl transition-all border border-transparent"
            title={theme === "dark" ? "เปลี่ยนเป็นโทนสว่าง" : "เปลี่ยนเป็นโทนมืด"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {loading ? (
            <div className="w-9 h-9 rounded-xl bg-surface animate-pulse" />
          ) : isLoggedIn ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-xl border border-surface/50">
                <User className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-body">{user?.name || "User"}</span>
              </div>
              <button onClick={logout}
                className="p-2 text-body hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={login}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl text-sm font-medium hover:bg-indigo-500/20 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
