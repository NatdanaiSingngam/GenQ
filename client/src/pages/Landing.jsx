import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Brain, Sparkles, ChevronRight, CheckCircle2, BookOpen,
  Zap, Clock, Target, Loader2, X, Plus, Minus, Settings2, FileCheck,
  Search, History, Wand2,
} from "lucide-react";
import { uploadFile } from "../api/client";
import { addToSessionHistory, getSessionHistory } from "../utils/history";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

const QUESTION_TYPES = [
  { key: "multipleChoice", label: "เลือกตอบ", icon: CheckCircle2, color: "from-indigo-400 to-indigo-500" },
  { key: "trueFalse", label: "ถูก-ผิด", icon: X, color: "from-emerald-400 to-emerald-500" },
  { key: "shortAnswer", label: "ตอบสั้น", icon: Zap, color: "from-amber-400 to-amber-500" },
  { key: "completion", label: "เติมคำ", icon: FileText, color: "from-violet-400 to-violet-500" },
  { key: "matching", label: "จับคู่", icon: BookOpen, color: "from-rose-400 to-rose-500" },
];

const DEFAULT_CONFIG = { multipleChoice: 3, trueFalse: 1, shortAnswer: 1, completion: 0, matching: 0 };

export default function Landing() {
  const navigate = useNavigate();
  const [configFile, setConfigFile] = useState(null);
  const [questionCounts, setQuestionCounts] = useState(DEFAULT_CONFIG);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  // Query history on global search
  useEffect(() => {
    if (!globalSearch.trim()) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }
    const q = globalSearch.toLowerCase();
    const history = getSessionHistory();
    const matched = history.filter(
      (h) =>
        h.title?.toLowerCase().includes(q) || h.source?.toLowerCase().includes(q)
    );
    setSearchResults(matched);
    setShowSearch(matched.length > 0);
  }, [globalSearch]);

  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    setError("");
    if (fileRejections.length > 0) {
      const r = fileRejections[0];
      if (r.errors?.[0]?.code === "file-too-large") {
        setError("❌ ไฟล์ใหญ่เกินไป (สูงสุด 15MB)");
      } else if (r.errors?.[0]?.code === "file-invalid-type") {
        setError("❌ รองรับเฉพาะไฟล์ PDF, PPTX, DOCX, TXT");
      } else {
        setError("❌ " + (r.errors?.[0]?.message || "ไฟล์ไม่ถูกต้อง"));
      }
      return;
    }
    if (acceptedFiles.length > 0) {
      setConfigFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: 15 * 1024 * 1024,
    multiple: false,
  });

  const adjustCount = (key, delta) => {
    setQuestionCounts((prev) => {
      const current = prev[key] || 0;
      const next = Math.max(0, Math.min(15, current + delta));
      return { ...prev, [key]: next };
    });
  };

  const setCountDirect = (key, val) => {
    const num = parseInt(val) || 0;
    setQuestionCounts((prev) => ({ ...prev, [key]: Math.max(0, Math.min(15, num)) }));
  };

  const totalSelected = Object.values(questionCounts).reduce((a, b) => a + b, 0);

  const handleGenerate = async () => {
    if (!configFile || totalSelected === 0) return;
    setError("");
    setUploading(true);
    setUploadProgress(0);

    try {
      const existingHistory = getSessionHistory().filter((h) => h.source === configFile.name);
      const round = existingHistory.length + 1;
      const configWithRound = { ...questionCounts, _r: round };

      const result = await uploadFile(configFile, configWithRound, (pct) => {
        setUploadProgress(Math.round((pct.loaded / pct.total) * 20));
      });

      addToSessionHistory({
        id: result.quizId,
        title: result.title,
        source: configFile.name,
        round,
        createdAt: new Date().toISOString(),
        questionCount: result.questionCount,
      });

      navigate(`/quiz/${result.quizId}?mode=view`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "เกิดข้อผิดพลาด";
      if (msg.includes("1102") || msg.includes("CPU")) {
        setError("❌ ไฟล์ใหญ่เกินไป (จำกัด 15MB) — ลองลดขนาดไฟล์");
      } else {
        setError("❌ " + msg);
      }
      setUploading(false);
    }
  };

  const totalAll = totalSelected;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Global Search */}
      <div className="relative max-w-2xl mx-auto w-full mt-8 mb-6 px-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
          <input
            type="text"
            placeholder="ค้นหาข้อสอบที่เคยสร้าง..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-[#1E293B] border-2 border-[#334155] rounded-2xl text-[#F8FAFC] placeholder-[#64748B] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-base"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F8FAFC]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search results */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-4 right-4 mt-2 bg-[#1E293B] border border-[#334155] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50"
            >
              {searchResults.slice(0, 5).map((quiz) => (
                <div
                  key={quiz.id}
                  onClick={() => navigate(`/quiz/${quiz.id}?mode=view`)}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#334155] cursor-pointer transition-colors border-b border-[#334155]/50 last:border-0"
                >
                  <div className="w-8 h-8 bg-indigo-500/15 rounded-lg flex items-center justify-center">
                    <History className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F8FAFC] truncate">{quiz.title}</p>
                    <p className="text-xs text-[#64748B] truncate">{quiz.source} • {quiz.questionCount} ข้อ</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#64748B]" />
                </div>
              ))}
              {searchResults.length > 5 && (
                <div className="px-4 py-2 text-xs text-[#64748B] text-center border-t border-[#334155]/50">
                  และอีก {searchResults.length - 5} รายการ — ดูทั้งหมดในประวัติ
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center px-4 mb-8"
      >
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#F8FAFC] leading-tight mb-4 tracking-tight">
          เปลี่ยน<span className="gradient-text">สไลด์เรียน</span>
          <br />
          เป็นข้อสอบใน{" "}
          <span className="bg-indigo-500/15 text-indigo-400 px-3 py-1 rounded-xl">1 นาที</span>
        </h1>
        <p className="text-lg text-[#64748B] max-w-lg mx-auto">
          ลากไฟล์สไลด์ลงมา แล้วให้ AI สร้างข้อสอบฝึกฝนให้คุณเลย
        </p>
      </motion.div>

      <div className="flex-1 flex flex-col items-center px-4 pb-12">
        {!configFile ? (
          /* Dropzone */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full max-w-2xl"
          >
            <div
              {...getRootProps()}
              className={`relative cursor-pointer rounded-3xl border-2 border-dashed p-16 sm:p-20 text-center transition-all duration-300 ${
                isDragActive
                  ? "border-indigo-500 bg-indigo-500/10 scale-[1.02]"
                  : "border-[#334155] hover:border-indigo-500/50 hover:bg-[#1E293B]/50"
              }`}
            >
              <input {...getInputProps()} />
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-300 ${
                isDragActive ? "bg-indigo-500/20 scale-110" : "bg-[#1E293B]"
              }`}>
                <Upload className={`w-10 h-10 transition-colors ${isDragActive ? "text-indigo-400" : "text-[#64748B]"}`} />
              </div>
              <p className="text-lg font-semibold text-[#F8FAFC] mb-2">
                {isDragActive ? "ปล่อยไฟล์เลย!" : "ลากไฟล์มาวางที่นี่"}
              </p>
              <p className="text-sm text-[#64748B] mb-6">หรือกดเพื่อเลือกไฟล์</p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-[#1E293B] text-[#94A3B8] rounded-full text-xs border border-[#334155]">PDF</span>
                <span className="px-3 py-1 bg-[#1E293B] text-[#94A3B8] rounded-full text-xs border border-[#334155]">PPTX</span>
                <span className="px-3 py-1 bg-[#1E293B] text-[#94A3B8] rounded-full text-xs border border-[#334155]">DOCX</span>
                <span className="px-3 py-1 bg-[#1E293B] text-[#94A3B8] rounded-full text-xs border border-[#334155]">TXT</span>
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs border border-indigo-500/30">สูงสุด 15MB</span>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Config Panel */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <div className="card mb-4">
              {/* File info */}
              <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-6">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#F8FAFC] truncate">{configFile.name}</p>
                  <p className="text-xs text-[#64748B]">{(configFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => { setConfigFile(null); setError(""); }}
                  className="p-2 text-[#64748B] hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Question type selectors */}
              <h3 className="text-sm font-semibold text-[#F8FAFC] mb-4 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-indigo-400" /> เลือกประเภทและจำนวนข้อสอบ
              </h3>
              <div className="space-y-2.5">
                {QUESTION_TYPES.map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="flex items-center justify-between bg-[#0F172A] rounded-xl px-4 py-2.5 border border-[#334155]/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-[#F8FAFC]">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => adjustCount(key, -1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#334155] transition-all disabled:opacity-30"
                        disabled={uploading}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={questionCounts[key]}
                        onChange={(e) => setCountDirect(key, e.target.value)}
                        className="w-14 text-center font-bold text-[#F8FAFC] bg-[#1E293B] border border-[#334155] rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="0" max="15"
                        disabled={uploading}
                      />
                      <button onClick={() => adjustCount(key, 1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#334155] transition-all disabled:opacity-30"
                        disabled={uploading}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <span className="text-sm text-[#94A3B8]">รวมทั้งหมด</span>
                <span className="text-lg font-bold text-indigo-400">{totalAll} ข้อ</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button onClick={handleGenerate} disabled={uploading || totalAll === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-lg py-4"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wand2 className="w-5 h-5" />
                )}
                {uploading ? `กำลังสร้าง... ${uploadProgress}%` : "✨ สร้างข้อสอบ"}
              </button>
              <button onClick={() => { setConfigFile(null); setError(""); }}
                className="p-4 bg-[#1E293B] border border-[#334155] rounded-xl text-[#64748B] hover:text-[#F8FAFC] hover:border-rose-500/30 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress bar */}
            {uploading && (
              <div className="mt-3 bg-[#1E293B] rounded-full h-2 overflow-hidden border border-[#334155]/50">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm max-w-2xl w-full"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features */}
        {!configFile && !uploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 max-w-2xl w-full"
          >
            {[
              { icon: Brain, title: "AI สร้างให้", desc: "วิเคราะห์เนื้อหาจากสไลด์ สร้างข้อสอบให้อัตโนมัติ", color: "from-indigo-400 to-indigo-500" },
              { icon: BookOpen, title: "หลายประเภ��", desc: "เลือกตอบ, ถูก-ผิด, เติมคำ, จับคู่, ตอบสั้น", color: "from-emerald-400 to-emerald-500" },
              { icon: Target, title: "ฝึกซ้ำได้", desc: "ทำซ้ำหลายรอบ เฉลยละเอียดทุกข้อ", color: "from-amber-400 to-amber-500" },
            ].map(({ icon: Icon, title, desc, color }, i) => (
              <div key={i} className="card text-center p-5">
                <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-[#F8FAFC] mb-1">{title}</h3>
                <p className="text-xs text-[#64748B]">{desc}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
