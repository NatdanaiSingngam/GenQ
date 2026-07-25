import { Link, useLocation } from "react-router-dom";
import { Brain, History, Zap, LogOut, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const location = useLocation();
  const isQuizPage = location.pathname.startsWith("/quiz");
  const { user, login, logout, isLoggedIn, loading } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 bg-gradient-to-br from-genq-500 to-genq-700 rounded-xl flex items-center justify-center shadow-lg shadow-genq-500/20 group-hover:scale-105 transition-transform">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold gradient-text">GenQ</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/history"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-genq-600 hover:bg-genq-50 rounded-xl transition-all"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">ประวัติ</span>
          </Link>

          {!isQuizPage && (
            <Link
              to="/history"
              className="flex items-center gap-2 btn-primary text-sm py-2 px-4 shadow-md"
            >
              <Zap className="w-4 h-4" />
              <span>เริ่มทำข้อสอบ</span>
            </Link>
          )}

          {/* Auth Section */}
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          ) : isLoggedIn ? (
            <div className="flex items-center gap-2">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border-2 border-genq-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-genq-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-genq-600" />
                </div>
              )}
              <span className="hidden sm:inline text-sm text-gray-700 font-medium">
                {user?.name?.split(" ")[0]}
              </span>
              <button
                onClick={logout}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                className="w-4 h-4"
              />
              <span className="hidden sm:inline">เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
