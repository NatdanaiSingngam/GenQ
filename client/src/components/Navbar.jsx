import { Link, useLocation } from "react-router-dom";
import { Brain, History, Zap } from "lucide-react";

export default function Navbar() {
  const location = useLocation();
  const isQuizPage = location.pathname.startsWith("/quiz");

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
        </div>
      </div>
    </nav>
  );
}
