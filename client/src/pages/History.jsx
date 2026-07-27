import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Clock, FileText, ChevronRight, Search, BookOpen, Inbox,
  Trash2, FolderOpen, Folder, ChevronDown, X, AlertCircle,
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
  const [confirmDelete, setConfirmDelete] = useState(null); // id or "all"

  useEffect(() => {
    (async () => {
      try {
        const sessionQuizzes = getSessionHistory();

        let serverQuizzes = [];
        if (isLoggedIn) {
          try {
            serverQuizzes = await getQuizList();
          } catch {}
        }

        const serverIds = new Set(serverQuizzes.map((q) => q.id));
        const merged = [...serverQuizzes, ...sessionQuizzes.filter((q) => !serverIds.has(q.id))];

        // For logged-in users, also filter out server-returned quizzes that were deleted
        const { getDeletedIds } = await import("../utils/history");
        const deletedIds = getDeletedIds();
        if (deletedIds.size > 0) {
          setQuizzes(merged.filter((q) => !deletedIds.has(q.id)));
        } else {
          setQuizzes(merged);
        }
      } catch {
        setQuizzes(getSessionHistory());
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoggedIn]);

  // Group quizzes by source filename
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

  // Separate sources with multiple quizzes into folders
  const folders = {};
  const standalone = [...singles];
  for (const [source, items] of Object.entries(grouped)) {
    if (items.length > 1) {
      // Sort by round or createdAt
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

  // Filter by search
  const filteredStandalone = standalone.filter(
    (q) =>
      q.title?.toLowerCase().includes(search.toLowerCase()) ||
      q.source?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredFolders = Object.entries(folders).filter(([source]) =>
    source.toLowerCase().includes(search.toLowerCase())
  );

  const toggleFolder = (source) => {
    setExpandedFolders((prev) => ({ ...prev, [source]: !prev[source] }));
  };

  const handleDeleteOne = (id) => {
    setConfirmDelete(id);
  };

  const confirmDeleteOne = (id) => {
    removeFromSessionHistory(id);
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    setConfirmDelete(null);
  };

  const handleDeleteFolder = (source) => {
    setConfirmDelete("folder:" + source);
  };

  const confirmDeleteFolder = (source) => {
    const items = folders[source] || [];
    for (const item of items) {
      removeFromSessionHistory(item.id);
    }
    setQuizzes((prev) => prev.filter((q) => q.source !== source));
    setConfirmDelete(null);
  };

  const handleClearAll = () => {
    setConfirmDelete("all");
  };

  const confirmClearAll = () => {
    clearSessionHistory();
    if (isLoggedIn) {
      getQuizList().then(setQuizzes).catch(() => setQuizzes([]));
    } else {
      setQuizzes([]);
    }
    setConfirmDelete(null);
  };

  if (loading) return <LoadingPage message="กำลังโหลดประวัติ..." />;

  const totalItems = quizzes.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-800">ประวัติข้อสอบ</h1>
          {totalItems > 0 && (
            <button onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all">
              <Trash2 className="w-4 h-4" /> ลบทั้งหมด
            </button>
          )}
        </div>
        <p className="text-gray-500 text-sm">
          {isLoggedIn
            ? "ข้อสอบทั้งหมดของคุณ (บันทึกถาวร)"
            : "ข้อสอบชั่วคราว — จะหายเมื่อปิดแท็บ แต่ก็ลบทีละอันได้"}
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

      {totalItems === 0 ? (
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
        <div className="space-y-2">
          {/* Folders (sources with multiple quizzes) */}
          {filteredFolders.length > 0 && (
            <div className="space-y-2 mb-4">
              {filteredFolders.map(([source, items]) => {
                const isExpanded = expandedFolders[source];
                const firstItem = items[0];
                return (
                  <div key={source} className="card overflow-hidden">
                    {/* Folder header */}
                    <div
                      onClick={() => toggleFolder(source)}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        {isExpanded ? (
                          <FolderOpen className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Folder className="w-5 h-5 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 truncate">{source}</h3>
                        <p className="text-sm text-gray-400">{items.length} ชุด</p>
                        {(() => {
                          const stats = getAttemptStats(source, items);
                          if (!stats) return null;
                          return (
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span className="text-gray-400">ทำ {stats.count} ครั้ง</span>
                              <span className="text-gray-300">|</span>
                              <span>ล่าสุด <span className="font-semibold text-genq-600">{stats.latest}%</span></span>
                              <span className="text-gray-300">|</span>
                              <span>ดีที่สุด <span className="font-semibold text-accent-600">{stats.best}%</span></span>
                            </div>
                          );
                        })()}
                      </div>
                      {confirmDelete === "folder:" + source ? (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => confirmDeleteFolder(source)}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
                          >
                            ลบ
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFolder(source); }}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          title="ลบโฟลเดอร์นี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronDown className={`w-5 h-5 text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>

                    {/* Folder items */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {items.map((quiz, idx) => (
                          <div
                            key={quiz.id}
                            className="flex items-center gap-3 px-4 py-3 pl-14 hover:bg-genq-50 transition-colors group border-b border-gray-50 last:border-0"
                          >
                            <div
                              onClick={() => navigate(`/quiz/${quiz.id}?mode=view`)}
                              className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
                            >
                              <div className="w-8 h-8 bg-genq-100 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-genq-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-800 text-sm truncate flex items-center gap-2">
                                  {quiz.title}
                                  <span className="text-xs text-genq-500 bg-genq-50 px-1.5 py-0.5 rounded shrink-0">
                                    ชุด {quiz.round || idx + 1}
                                  </span>
                                  {idx === items.length - 1 && (
                                    <span className="text-xs text-accent-600 bg-accent-100 px-1.5 py-0.5 rounded shrink-0">
                                      ล่าสุด
                                    </span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" /> {quiz.questionCount} ข้อ
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {quiz.createdAt
                                      ? new Date(quiz.createdAt).toLocaleDateString("th-TH", {
                                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                                        })
                                      : ""}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                            </div>

                            {/* Individual delete button */}
                            {confirmDelete === quiz.id ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); confirmDeleteOne(quiz.id); }}
                                  className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
                                >
                                  ลบ
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                                  className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteOne(quiz.id); }}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                title="ลบรายการนี้"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Standalone quizzes (no source or single per source) */}
          {filteredStandalone.length > 0 && (
            <div className="space-y-2">
              {filteredStandalone.map((quiz, i) => (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="card-hover flex items-center gap-4 cursor-pointer group relative"
                >
                  <div
                    onClick={() => navigate(`/quiz/${quiz.id}?mode=view`)}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    <div className="w-12 h-12 bg-genq-100 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-genq-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 line-clamp-1">{quiz.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" /> {quiz.questionCount} ข้อ
                        </span>
                        {quiz.source && (
                          <span className="text-xs text-gray-300 truncate max-w-[150px]">{quiz.source}</span>
                        )}
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
                  </div>

                  {/* Delete button */}
                  {confirmDelete === quiz.id ? (
                    <div className="flex items-center gap-1 shrink-0 pr-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmDeleteOne(quiz.id); }}
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
                      >
                        ลบ
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                        className="px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteOne(quiz.id); }}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0 mr-1"
                      title="ลบรายการนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {filteredStandalone.length === 0 && filteredFolders.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Search className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">ไม่พบข้อสอบที่ค้นหา</p>
              <p className="text-gray-400 text-sm">ลองเปลี่ยนคำค้นหา</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Confirmation dialog for clear all */}
      {confirmDelete === "all" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">ลบประวัติทั้งหมด?</h3>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              การลบประวัติในเครื่องนี้จะไม่สามารถกู้คืนได้สำหรับข้อสอบชั่วคราว
              {isLoggedIn ? " (ข้อสอบบนเซิร์ฟเวอร์จะไม่ถูกลบ)" : ""}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmClearAll}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-all"
              >
                ลบทั้งหมด
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
