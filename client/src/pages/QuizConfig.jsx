import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Brain, Sliders, Plus, Minus, ChevronRight, Clock, Timer } from "lucide-react";
import { uploadFile } from "../api/client";
import { addToSessionHistory } from "../utils/history";
import { getPendingFile, getPendingFileName, clearPendingFile } from "../utils/fileStore";

const QUESTION_TYPES = [
  { key: "multipleChoice", label: "เลือกตอบ", desc: "Multiple Choice 4 ตัวเลือก", icon: "A" },
  { key: "trueFalse", label: "ถูก-ผิด", desc: "True-False", icon: "✓" },
  { key: "completion", label: "เติมคำ", desc: "Fill-in-blank", icon: "___" },
  { key: "shortAnswer", label: "ตอบสั้น", desc: "Short Answer", icon: "✏" },
  { key: "essay", label: "เขียนตอบ", desc: "Essay", icon: "📝" },
];

const TIME_OPTIONS = [
  { label: "ไม่จำกัด", value: 0 },
  { label: "5 นาที", value: 5 },
  { label: "10 นาที", value: 10 },
  { label: "15 นาที", value: 15 },
  { label: "30 นาที", value: 30 },
  { label: "60 นาที", value: 60 },
];

export default function QuizConfig() {
  const navigate = useNavigate();
  const [file, setFile] = useState(getPendingFile);
  const [fileName] = useState(getPendingFileName);
  const [counts, setCounts] = useState({ multipleChoice: 3, trueFalse: 1, shortAnswer: 1 });
  const [timeLimit, setTimeLimit] = useState(0); // minutes, 0 = unlimited
  const [customTime, setCustomTime] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const total = Object.values(counts).reduce((a, b) => (parseInt(b) || 0) + a, 0);
  const hasAny = total > 0;

  const adjust = useCallback((key, delta) => {
    setCounts((prev) => {
      const current = parseInt(prev[key]) || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      if (next === current) return prev;
      return { ...prev, [key]: next };
    });
  }, []);

  const handleTimeSelect = useCallback((val) => {
    setTimeLimit(val);
    if (TIME_OPTIONS.some((o) => o.value === val)) {
      setCustomTime("");
    }
  }, []);

  const handleCustomTime = useCallback((e) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setCustomTime(val);
    const num = parseInt(val) || 0;
    if (num > 0) setTimeLimit(num);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!file || !hasAny) return;
    setGenerating(true);
    setError(null);

    try {
      const config = {};
      for (const [k, v] of Object.entries(counts)) {
        const n = parseInt(v) || 0;
        if (n > 0) config[k] = n;
      }
      if (timeLimit > 0) config.timeLimit = timeLimit;
      const result = await uploadFile(file, null, config);
      clearPendingFile();
      addToSessionHistory({ id: result.quizId, title: result.title, questionCount: result.questionCount, source: fileName || file?.name || "document", createdAt: new Date().toISOString() });
      navigate(`/quiz/${result.quizId}`, { replace: true });
    } catch (e) {
      setError(e.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      setGenerating(false);
    }
  }, [file, counts, hasAny, navigate]);

  if (!file) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-2xl flex items-center justify-center">
            <FileText className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">ไม่พบไฟล์</h2>
          <p className="text-gray-500 mb-6">กรุณาอัปโหลดไฟล์ก่อนเลือกประเภทข้อสอบ</p>
          <button onClick={() => navigate("/")} className="btn-primary">
            กลับไปหน้าแรก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* File info */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="w-10 h-10 bg-genq-100 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-genq-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 truncate">{file.name}</p>
          <p className="text-sm text-gray-400">
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <Upload className="w-5 h-5 text-genq-400" />
      </div>

      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-genq-400 to-genq-600 rounded-2xl flex items-center justify-center shadow-lg shadow-genq-500/20">
          <Sliders className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-800 mb-2">
          เลือกประเภทข้อสอบ
        </h1>
        <p className="text-gray-500">
          เลือกประเภทและจำนวนข้อสอบที่ต้องการให้ AI สร้างจากไฟล์ของคุณ
        </p>
      </div>

      {/* Question type selectors */}
      {/* Time Limit Selector */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">ตั้งเวลาทำข้อสอบ</h2>
            <p className="text-xs text-gray-400">กำหนดเวลาในการทำข้อสอบ (ระบบจะส่งคำตอบให้อัตโนมัติเมื่อหมดเวลา)</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTimeSelect(opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                timeLimit === opt.value && !customTime
                  ? "border-orange-400 bg-orange-50 text-orange-700 shadow-sm"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="กำหนดเอง (นาที)"
              value={customTime}
              onChange={handleCustomTime}
              className={`w-36 px-4 py-2 rounded-xl text-sm font-medium border-2 outline-none transition-all ${
                customTime
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-gray-200 bg-white text-gray-500 focus:border-orange-300"
              }`}
            />
            {customTime && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-500">นาที</span>
            )}
          </div>
        </div>
        {timeLimit > 0 && (
          <p className="mt-2 text-xs text-orange-500 flex items-center gap-1">
            <Timer className="w-3 h-3" />
            จะมีเวลา {timeLimit} นาทีในการทำข้อสอบ
          </p>
        )}
      </div>

      <div className="space-y-3 mb-10">
        {QUESTION_TYPES.map((qt) => {
          const val = parseInt(counts[qt.key]) || 0;
          return (
            <div
              key={qt.key}
              className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                val > 0
                  ? "border-genq-200 bg-genq-50/50 shadow-sm"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                  val > 0
                    ? "bg-genq-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {qt.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{qt.label}</p>
                <p className="text-xs text-gray-400">{qt.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjust(qt.key, -1)}
                  disabled={val <= 0}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-bold text-lg text-gray-700">
                  {val}
                </span>
                <button
                  onClick={() => adjust(qt.key, 1)}
                  disabled={val >= 10}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary & Generate */}
      <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-600 font-medium">จำนวนข้อสอบทั้งหมด</span>
          <span className={`text-2xl font-extrabold ${total > 0 ? "text-genq-600" : "text-gray-300"}`}>
            {total} ข้อ
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!hasAny || generating}
          className="w-full btn-primary py-3 flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>กำลังสร้างข้อสอบ...</span>
            </>
          ) : (
            <>
              <Brain className="w-5 h-5" />
              <span>สร้างข้อสอบด้วย AI</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
