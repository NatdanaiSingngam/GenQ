import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Clock, FileText, ChevronRight, Search, BookOpen, Inbox, Trash2, User,
} from "lucide-react";
import { getQuizList } from "../api/client";
import { getSessionHistory, clearSessionHistory } from "../utils/history";
import { useAuth } from "../contexts/AuthContext";
import LoadingPage from "../components/LoadingPage";

export default function History() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Always get session history (guest quizzes)
        const sessionQuizzes = getSessionHistory();

        // If logged in, also fetch from KV
        let serverQuizzes = [];
        if (isLoggedIn) {
          try {
            serverQuizzes = await getQuizList();
          } catch {}
        }

        // Merge: KV quizzes first (persistent), then session quizzes (not duplicated)
        const serverIds = new Set(serverQuizzes.map((q) => q.id));
        const merged = [...serverQuizzes, ...sessionQuizzes.filter((q) => !serverIds.has(q.id))];
        setQuizzes(merged);
      } catch {
        setQuizzes(getSessionHistory());
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoggedIn]);

  const handleClear = () => {
    if (confirm("แน่ใจหรือว่าต้องการลบประวัติทั้งหมดในเครื่องนี้?")) {
      clearSessionHistory();
      // Only keep server quizzes
      if (isLoggedIn) {
        getQuizList().then(setQuizzes).catch(() => setQuizzes([]));
      } else {
        setQuizzes([]);
      }
    }
  };

  const filtered = quizzes.filter(
    (q) =>
      q.title?.toLowerCase().includes(search.toLowerCase()) ||
      q.source?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingPage message="กำลังโหลดประวัติ..." />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-800">ประวัติข้อสอบ</h1>
          {quizzes.length > 0 && (
            <button onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all">
              <Trash2 className="w-4 h-4" /> ลบประวัติ
            </button>
          )}
        </div>
        <p className="text-gray-500">
          {isLoggedIn
            ? "ข้อสอบทั้งหมดของคุณ (บันทึกถาวร)"
            : "ข้อสอบชั่วคราว (จะหายเมื่อปิดแท็บ)"}
        </p>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="ค้นหาชื่อข้อสอบ หรือชื่อไฟล์..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-genq-400 focus:ring-2 focus:ring-genq-100 outline-none transition-all" />
      </motion.div>

      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-2">
            {search ? "ไม่พบข้อสอบที่ค้นหา" : "ยังไม่มีข้อสอบที่เคยสร้าง"}
          </p>
          <p className="text-gray-400 text-sm mb-4">
            {search ? "ลองเปลี่ยนคำค้นหา" : "ลองอัปโหลดไฟล์สไลด์เพื่อเริ่มต้น"}
          </p>
          <button onClick={() => navigate("/")} className="btn-primary text-sm">ไปที่หน้าแรก</button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((quiz, i) => (
            <motion.div key={quiz.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/quiz/${quiz.id}`)}
              className="card-hover flex items-center gap-4 cursor-pointer">
              <div className="w-12 h-12 bg-genq-100 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-genq-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 line-clamp-1">{quiz.title}</h3>
                <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> {quiz.questionCount} ข้อ
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {quiz.createdAt
                      ? new Date(quiz.createdAt).toLocaleDateString("th-TH", {
                          year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })
                      : "ไม่ระบุเวลา"}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
