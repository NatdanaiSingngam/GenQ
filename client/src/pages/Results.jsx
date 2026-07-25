import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Award, Target, BookOpen, ChevronLeft, RotateCcw, Home,
  AlertTriangle, CheckCircle2, XCircle, HelpCircle,
  AlignLeft, SplitSquareHorizontal, Type, FileText, Printer,
} from "lucide-react";
import LoadingPage from "../components/LoadingPage";
import { saveAttempt } from "../utils/attempts";

function formatUserAnswer(q, userAnswer) {
  if (userAnswer === null || userAnswer === undefined) return "ไม่ได้ตอบ";
  const type = q.type || "multiple-choice";
  switch (type) {
    case "multiple-choice":
    case "true-false":
      return q.options?.[userAnswer] ?? `ตัวเลือก ${userAnswer}`;
    case "completion":
    case "short-answer":
    case "essay":
      return userAnswer || "ไม่ได้ตอบ";
    case "matching":
      if (typeof userAnswer === "object") {
        const pairs = Object.entries(userAnswer).filter(([, v]) => v);
        return pairs.length ? pairs.map(([k, v]) => `${k}→${v}`).join(", ") : "ไม่ได้ตอบ";
      }
      return "ไม่ได้ตอบ";
    default:
      return String(userAnswer);
  }
}

function formatCorrectAnswer(q) {
  const type = q.type || "multiple-choice";
  switch (type) {
    case "multiple-choice":
    case "true-false":
      return q.options?.[q.correctIndex] ?? `ตัวเลือก ${q.correctIndex}`;
    case "completion":
      return q.answer || q.acceptableAnswers?.[0] || "-";
    case "short-answer":
      return q.answer || q.keywords?.[0] || "-";
    case "matching":
      return q.pairs?.map((p) => `${p.left}→${p.right}`).join(", ") || "-";
    case "essay":
      return "รอการตรวจ (Essay)";
    default:
      return "-";
  }
}

const TYPE_LABELS = {
  "multiple-choice": "เลือกตอบ", "true-false": "ถูก-ผิด", completion: "เติมคำ",
  "short-answer": "ตอบสั้น", matching: "จับคู่", essay: "เขียนตอบ",
};
const TYPE_ICONS = {
  "multiple-choice": HelpCircle, "true-false": CheckCircle2, completion: Type,
  "short-answer": AlignLeft, matching: SplitSquareHorizontal, essay: FileText,
};

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const results = location.state;
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  useEffect(() => {
    if (!results) navigate("/", { replace: true });
    else if (results.score !== undefined) saveAttempt(id, results);
  }, [results, navigate, id]);

  if (!results) return null;

  const { score, grade, correctCount, total, questions, title, weakAreas, pendingCount } = results;

  const getGradeInfo = (g) => {
    if (g === "A") return { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", msg: "ยอดเยี่ยม!" };
    if (g === "B") return { color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/30", msg: "ดีมาก!" };
    if (g === "C") return { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", msg: "พอใช้" };
    if (g === "D") return { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", msg: "ควรทบทวน" };
    if (g === "รอตรวจ") return { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", msg: "มีข้อรอตรวจ" };
    return { color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/30", msg: "ต้องปรับปรุง" };
  };
  const gradeInfo = getGradeInfo(grade);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-hover/50 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-heading">ผลลัพธ์การสอบ</h1>
          <p className="text-sm text-muted">{title}</p>
        </div>
      </motion.div>

      {/* Score Card */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        className={`card mb-6 text-center p-8 sm:p-10 border-2 ${gradeInfo.bg}`}>
        <div className="relative w-36 h-36 mx-auto mb-6">
          <svg className="w-full h-full" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#334155" strokeWidth="8" />
            <motion.circle cx="60" cy="60" r="52" fill="none"
              stroke="currentColor"
              className={score >= 80 ? "text-emerald-400" : score >= 60 ? "text-indigo-400" : "text-rose-400"}
              strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 52}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - score / 100) }}
              transition={{ duration: 1.5, ease: "easeOut" }} transform="rotate(-90 60 60)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="text-4xl font-extrabold text-heading">{score}</motion.span>
            <span className="text-sm text-muted font-medium">คะแนน</span>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full text-2xl font-black ${gradeInfo.color} mb-3`}>
            <Award className="w-6 h-6" /> เกรด {grade}
          </div>
          <p className="text-body font-medium">{gradeInfo.msg}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-surface/50">
          <div className="text-center"><p className="text-2xl font-bold text-emerald-400">{correctCount}</p><p className="text-sm text-muted">ถูก</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-rose-400">{total - correctCount - (pendingCount || 0)}</p><p className="text-sm text-muted">ผิด</p></div>
          {pendingCount > 0 && <div className="text-center"><p className="text-2xl font-bold text-amber-400">{pendingCount}</p><p className="text-sm text-muted">รอตรวจ</p></div>}
          <div className="text-center"><p className="text-2xl font-bold text-indigo-400">{total}</p><p className="text-sm text-muted">ทั้งหมด</p></div>
        </motion.div>
      </motion.div>

      {/* Weak Areas */}
      {weakAreas?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="card mb-6 border-l-4 border-l-orange-500">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-500/15 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-heading mb-2">จุดที่ต้องกลับไปทบทวน</h3>
              <p className="text-sm text-muted mb-3">คุณตอบผิด {weakAreas.length} ข้อ แนะนำให้กลับไปอ่านเนื้อหาเกี่ยวกับหัวข้อเหล่านี้เพิ่มเติม:</p>
              <div className="space-y-2">
                {weakAreas.map((area, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-body bg-rose-500/10 rounded-lg px-3 py-2">
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{area}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Question Review */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h3 className="font-bold text-heading mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" /> ตรวจคำตอบแต่ละข้อ
        </h3>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const Ti = TYPE_ICONS[q.type] || HelpCircle;
            const isSelected = selectedQuestion === i;
            return (
              <motion.div key={q.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.05 }}
                className={`card cursor-pointer transition-all duration-200 ${isSelected ? "ring-2 ring-[var(--accent)]" : ""}`}
                onClick={() => setSelectedQuestion(isSelected ? null : i)}>
                <div className="flex items-start gap-3">
                  {q.autoGrade === false ? (
                    <FileText className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  ) : q.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-heading line-clamp-2 flex-1">{q.question}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-muted"><Ti className="w-3 h-3" /> {TYPE_LABELS[q.type] || q.type}</span>

                    {isSelected && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 pt-3 border-t border-surface/50 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted">คำตอบของคุณ:</span>
                          <span className={`font-medium ${q.autoGrade === false ? "text-amber-400" : q.isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                            {formatUserAnswer(q, q.userAnswer)}
                          </span>
                        </div>
                        {q.autoGrade !== false && !q.isCorrect && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted">เฉลยที่ถูก:</span>
                            <span className="font-medium text-indigo-400">{formatCorrectAnswer(q)}</span>
                          </div>
                        )}
                        {q.autoGrade === false && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted">แนวคำตอบ:</span>
                            <span className="font-medium text-amber-400">{formatCorrectAnswer(q)}</span>
                          </div>
                        )}
                        {q.explanation && (
                          <div className="flex gap-2 p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <svg className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                              <path d="M9 18h6" /><path d="M10 22h4" />
                            </svg>
                            <p className="text-sm text-body">{q.explanation}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
                    q.autoGrade === false ? "bg-amber-500/10 text-amber-400"
                    : q.isCorrect ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
                  }`}>
                    {q.autoGrade === false ? "รอตรวจ" : q.isCorrect ? "ถูก" : "ผิด"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="flex flex-wrap gap-3 mt-8 justify-center no-print">
        <button onClick={() => navigate(`/quiz/${id}?mode=take`)} className="btn-primary text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> ทำอีกครั้ง
        </button>
        <button onClick={() => window.print()} className="btn-secondary text-sm flex items-center gap-2">
          <Printer className="w-4 h-4" /> พิมพ์
        </button>
        <button onClick={() => navigate("/")} className="btn-secondary text-sm flex items-center gap-2">
          <Home className="w-4 h-4" /> กลับหน้าแรก
        </button>
      </motion.div>
    </div>
  );
}
