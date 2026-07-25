import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, FileText, ChevronRight, Search, BookOpen, Inbox,
  Trash2, FolderOpen, Folder, ChevronDown, X, AlertCircle,
  Brain, Award,
} from "lucide-react";
import { getQuizList } from "../api/client";
import { getSessionHistory, clearSessionHistory, removeFromSessionHistory } from "../utils/history";
import { getAttemptStats } from "../utils/attempts";
import { useAuth } from "../contexts/AuthContext";
import LoadingPage from "../components/LoadingPage";

export default function History() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const sessionQuizzes = getSessionHistory();
        let serverQuizzes = [];
        if (isLoggedIn) {
          try { serverQuizzes = await getQuizList(); } catch {}
        }
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

  const grouped = {};
  const singles = [];
  for (const q of quizzes) {
    if (q.source) {
      if (!grouped[q.source]) grouped[q.source] = [];
      grouped[q.source].push(q);
    } else {
      singles.push(q);
    }
  }

  const folders = {};
  const standalone = [...singles];
  for (const [source, items] of Object.entries(grouped)) {
    if (items.length > 1) {
      items.sort((a, b) => {
        const ra = a.round || 0;
        const rb = b.round || 0;
        if (ra !== rb) return ra - rb;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
      folders[source] = items;
    } else {
      standalone.push(items[0]);
    }
  }

  const sq = search.toLowerCase();
  const filteredStandalone = standalone.filter(
    (q) => q.title?.toLowerCase().includes(sq) || q.source?.toLowerCase().includes(sq)
  );
  const filteredFolders = Object.entries(folders).filter(([s]) => s.toLowerCase().includes(sq));

  const toggleFolder = (s) => setExpandedFolders((prev) => ({ ...prev, [s]: !prev[s] }));
  const handleDeleteOne = (id) => setConfirmDelete(id);
  const confirmDeleteOne = (id) => {
    removeFromSessionHistory(id);
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    setConfirmDelete(null);
  };
  const handleDeleteFolder = (s) => setConfirmDelete("folder:" + s);
  const confirmDeleteFolder = (s) => {
    (folders[s] || []).forEach((item) => removeFromSessionHistory(item.id));
    setQuizzes((prev) => prev.filter((q) => q.source !== s));
    setConfirmDelete(null);
  };
  const handleClearAll = () => setConfirmDelete("all");
  const confirmClearAll = () => {
    clearSessionHistory();
    if (isLoggedIn) getQuizList().then(setQuizzes).catch(() => setQuizzes([]));
    else setQuizzes([]);
    setConfirmDelete(null);
  };

  if (loading) return <LoadingPage message="กำลังโหลดประวัติ..." />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-[#F8FAFC] flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/15 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>
            ประวัติข้อสอบ
          </h1>
          {quizzes.length > 0 && (
            <button onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" /> ลบทั้งหมด
            </button>
          )}
        </div>
        <p className="text-[#64748B] text-sm">
          {isLoggedIn ? "ข้อสอบทั้งหมดของคุณ (บันทึกถาวร)" : "ข้อสอบชั่วคราว — จะหายเมื่อปิดแท็บ"}
        </p>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
        <input type="text" placeholder="ค้นหาชื่อข้อสอบ หรือชื่อไฟล์..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-12" />
      </motion.div>

      {quizzes.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="w-20 h-20 bg-[#1E293B] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#334155]/50">
            <Inbox className="w-8 h-8 text-[#64748B]" />
          </div>
          <p className="text-[#94A3B8] font-medium mb-2">
            {search ? "ไม่พบข้อสอบที่ค้นหา" : "ยังไม่มีข้อสอบที่เคยสร้าง"}
          </p>
          <p className="text-[#64748B] text-sm mb-4">
            {search ? "ลองเปลี่ยนคำค้นหา" : "ลองอัปโหลดไฟล์สไลด์เพื่อเริ่มต้น"}
          </p>
          <button onClick={() => navigate("/")} className="btn-primary text-sm">ไปที่หน้าแรก</button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {/* Folders */}
          {filteredFolders.length > 0 && (
            <AnimatePresence>
              {filteredFolders.map(([source, items]) => {
                const isExpanded = expandedFolders[source];
                const stats = getAttemptStats(source, items);
                return (
                  <motion.div key={source} layout className="card overflow-hidden p-0">
                    <div onClick={() => toggleFolder(source)}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#334155]/30 transition-colors"
                    >
                      <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center shrink-0">
                        {isExpanded ? <FolderOpen className="w-5 h-5 text-amber-400" /> : <Folder className="w-5 h-5 text-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#F8FAFC] truncate">{source}</h3>
                        <p className="text-sm text-[#64748B]">{items.length} ชุด</p>
                        {stats && (
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-[#64748B]">ทำ {stats.count} ครั้ง</span>
                            <span className="text-[#334155]">|</span>
                            <span>ล่าสุด <span className="font-semibold text-indigo-400">{stats.latest}%</span></span>
                            <span className="text-[#334155]">|</span>
                            <span>ดีที่สุด <span className="font-semibold text-emerald-400">{stats.best}%</span></span>
                          </div>
                        )}
                      </div>
                      {confirmDelete === "folder:" + source ? (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => confirmDeleteFolder(source)}
                            className="px-2 py-1 text-xs font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600">ลบ</button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 text-xs text-[#94A3B8] hover:bg-[#334155] rounded-lg">ยกเลิก</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(source); }}
                          className="p-1.5 text-[#64748B] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronDown className={`w-5 h-5 text-[#64748B] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#334155]/50">
                        {items.map((quiz, idx) => (
                          <div key={quiz.id}
                            className="flex items-center gap-3 px-4 py-3 pl-14 hover:bg-[#334155]/20 transition-colors group border-b border-[#334155]/30 last:border-0"
                          >
                            <div onClick={() => navigate(`/quiz/${quiz.id}?mode=view`)}
                              className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
                            >
                              <div className="w-8 h-8 bg-indigo-500/15 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-indigo-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-[#F8FAFC] text-sm truncate flex items-center gap-2">
                                  {quiz.title}
                                  <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">ชุด {quiz.round || idx + 1}</span>
                                  {idx === items.length - 1 && (
                                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">ล่าสุด</span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-3 text-xs text-[#64748B] mt-0.5">
                                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {quiz.questionCount} ข้อ</span>
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                                    {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
                            </div>

                            {confirmDelete === quiz.id ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); confirmDeleteOne(quiz.id); }}
                                  className="px-2 py-1 text-xs font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600">ลบ</button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                                  className="px-2 py-1 text-xs text-[#94A3B8] hover:bg-[#334155] rounded-lg">ยกเลิก</button>
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteOne(quiz.id); }}
                                className="p-1.5 text-[#64748B] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Standalone items */}
          {filteredStandalone.length > 0 && (
            <div className="space-y-2">
              {filteredStandalone.map((quiz, i) => (
                <motion.div key={quiz.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="card-hover flex items-center gap-4 cursor-pointer group relative p-4"
                >
                  <div onClick={() => navigate(`/quiz/${quiz.id}?mode=view`)}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    <div className="w-12 h-12 bg-indigo-500/15 rounded-xl flex items-center justify-center shrink-0">
                      <Brain className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#F8FAFC] line-clamp-1">{quiz.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-[#64748B] mt-1">
                        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {quiz.questionCount} ข้อ</span>
                        {quiz.source && <span className="text-xs text-[#475569] truncate max-w-[150px]">{quiz.source}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />
                          {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#64748B] shrink-0" />
                  </div>

                  {confirmDelete === quiz.id ? (
                    <div className="flex items-center gap-1 shrink-0 pr-2">
                      <button onClick={(e) => { e.stopPropagation(); confirmDeleteOne(quiz.id); }}
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600">ลบ</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                        className="px-2.5 py-1.5 text-xs text-[#94A3B8] hover:bg-[#334155] rounded-lg">ยกเลิก</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteOne(quiz.id); }}
                      className="p-2 text-[#64748B] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0 mr-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {filteredStandalone.length === 0 && filteredFolders.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <div className="w-16 h-16 bg-[#1E293B] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[#334155]/50">
                <Search className="w-7 h-7 text-[#64748B]" />
              </div>
              <p className="text-[#94A3B8] font-medium">ไม่พบข้อสอบที่ค้นหา</p>
              <p className="text-[#64748B] text-sm">ลองเปลี่ยนคำค้นหา</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Clear all confirmation modal */}
      {confirmDelete === "all" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1E293B] rounded-2xl shadow-2xl shadow-black/40 p-6 max-w-sm w-full border border-[#334155]/50"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-500/15 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-[#F8FAFC]">ลบประวัติทั้งหมด?</h3>
            </div>
            <p className="text-[#94A3B8] text-sm mb-6">
              การลบประวัติในเครื่องนี้จะไม่สามารถกู้คืนได้สำหรับข้อสอบชั่วคราว
              {isLoggedIn ? " (ข้อสอบบนเซิร์ฟเวอร์จะไม่ถูกลบ)" : ""}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 border border-[#334155] rounded-xl text-[#94A3B8] font-medium hover:bg-[#334155] transition-all">
                ยกเลิก
              </button>
              <button onClick={confirmClearAll}
                className="flex-1 px-4 py-2.5 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-all">
                ลบทั้งหมด
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
