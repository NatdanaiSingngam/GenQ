import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Award, Target, BookOpen, ChevronLeft, RotateCcw, Eye, Home,
  AlertTriangle, CheckCircle2, XCircle, HelpCircle,
  AlignLeft, SplitSquareHorizontal, Type, FileText,
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
  "multiple-choice": "เลือกตอบ",
  "true-false": "ถูก-ผิด",
  completion: "เติมคำ",
  "short-answer": "ตอบสั้น",
  matching: "จับคู่",
  essay: "เขียนตอบ",
};

const TYPE_ICONS = {
  "multiple-choice": HelpCircle,
  "true-false": CheckCircle2,
  completion: Type,
  "short-answer": AlignLeft,
  matching: SplitSquareHorizontal,
  essay: FileText,
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

  const { score, grade, correctCount, total, questions, title, weakAreas, pendingCount, autoGradeCount } = results;
  const hasPending = pendingCount > 0;

  const getGradeColor = (g) => {
    if (g === "A") return "text-accent-500";
    if (g === "B") return "text-genq-500";
    if (g === "C") return "text-yellow-500";
    if (g === "D") return "text-orange-500";
    if (g === "รอตรวจ") return "text-amber-500";
    return "text-red-500";
  };

  const getGradeBg = (g) => {
    if (g === "A") return "bg-accent-50 border-accent-200";
    if (g === "B") return "bg-genq-50 border-genq-200";
    if (g === "C") return "bg-yellow-50 border-yellow-200";
    if (g === "D") return "bg-orange-50 border-orange-200";
    if (g === "รอตรวจ") return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  };

  const getGradeMessage = (g) => {
    if (g === "A") return "ยอดเยี่ยม! คุณเข้าใจเนื้อหาเป็นอย่างดี";
    if (g === "B") return "ดีมาก! มีบางจุดที่ต้องทบทวนเพิ่ม";
    if (g === "C") return "พอใช้ ควรกลับไปอ่านทบทวนเพิ่มเติม";
    if (g === "D") return "ควรกลับไปอ่านใหม่ ยังไม่ผ่านเกณฑ์";
    if (g === "รอตรวจ") return "มีข้อสอบ Essay ที่รอการตรวจ ให้ตรวจสอบด้วยตัวเอง";
    return "ต้องปรับปรุง แนะนำให้อ่านเนื้อหาใหม่ทั้งหมด";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">ผลลัพธ์การสอบ</h1>
          <p className="text-sm text-gray-400">{title}</p>
        </div>
      </motion.div>

      {/* Score Card */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
        className={`card mb-6 text-center p-8 sm:p-10 border-2 ${getGradeBg(grade)}`}>
        <div className="relative w-36 h-36 mx-auto mb-6">
          <svg className="w-full h-full" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" className="text-gray-100" strokeWidth="8" />
            <motion.circle cx="60" cy="60" r="52" fill="none" stroke="currentColor"
              className={score >= 80 ? "text-accent-500" : score >= 60 ? "text-genq-500" : "text-red-500"}
              strokeWidth="8" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 52}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - score / 100) }}
              transition={{ duration: 1.5, ease: "easeOut" }} transform="rotate(-90 60 60)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: "spring" }}
              className="text-4xl font-extrabold text-gray-800">{score}</motion.span>
            <span className="text-sm text-gray-400 font-medium">คะแนน</span>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full text-2xl font-black ${getGradeColor(grade)} mb-3`}>
            <Award className="w-6 h-6" /> เกรด {grade}
          </div>
          <p className="text-gray-600 font-medium">{getGradeMessage(grade)}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-accent-500">{correctCount}</p>
            <p className="text-sm text-gray-400">ถูก</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{total - correctCount - (pendingCount || 0)}</p>
            <p className="text-sm text-gray-400">ผิด</p>
          </div>
          {hasPending && (
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
              <p className="text-sm text-gray-400">รอตรวจ</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-2xl font-bold text-genq-500">{total}</p>
            <p className="text-sm text-gray-400">ทั้งหมด</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Pending Notice */}
      {hasPending && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-amber-700 text-sm">
            📝 ข้อสอบ Essay ต้องรอการตรวจด้วยตนเอง ให้คุณอ่านแนวคำตอบแล้วประเมินเอง
          </p>
        </motion.div>
      )}

      {/* Weak Areas */}
      {weakAreas?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="card mb-6 border-l-4 border-l-orange-400">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800 mb-2">จุดที่ต้องกลับไปทบทวน</h3>
              <p className="text-sm text-gray-500 mb-3">คุณตอบผิด {weakAreas.length} ข้อ แนะนำให้กลับไปอ่านเนื้อหาเกี่ยวกับหัวข้อเหล่านี้เพิ่มเติม:</p>
              <div className="space-y-2">
                {weakAreas.map((area, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-orange-50 rounded-lg px-3 py-2">
                    <XCircle className="w-4 h-4 text-orange-400 shrink-0" />
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
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-genq-500" /> ตรวจคำตอบแต่ละข้อ
        </h3>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const Ti = TYPE_ICONS[q.type] || HelpCircle;
            return (
              <motion.div key={q.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.05 }}
                className={`card cursor-pointer transition-all duration-200 hover:shadow-lg ${selectedQuestion === i ? "ring-2 ring-genq-500" : ""}`}
                onClick={() => setSelectedQuestion(selectedQuestion === i ? null : i)}>
                <div className="flex items-start gap-3">
                  {q.autoGrade === false ? (
                    <FileText className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  ) : q.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-accent-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-gray-800 line-clamp-2 flex-1">{q.question}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Ti className="w-3 h-3" /> {TYPE_LABELS[q.type] || q.type}
                    </span>

                    {selectedQuestion === i && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">คำตอบของคุณ:</span>
                          <span className={`font-medium ${q.autoGrade === false ? "text-amber-600" : q.isCorrect ? "text-accent-600" : "text-red-600"}`}>
                            {formatUserAnswer(q, q.userAnswer)}
                          </span>
                        </div>
                        {q.autoGrade !== false && !q.isCorrect && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">เฉลยที่ถูก:</span>
                            <span className="font-medium text-genq-600">{formatCorrectAnswer(q)}</span>
                          </div>
                        )}
                        {q.autoGrade === false && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">แนวคำตอบ:</span>
                            <span className="font-medium text-amber-600">{formatCorrectAnswer(q)}</span>
                          </div>
                        )}
                        {q.explanation && (
                          <div className="flex gap-2 p-3 bg-genq-50 rounded-xl">
                            <svg className="w-4 h-4 text-genq-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                              <path d="M9 18h6" /><path d="M10 22h4" />
                            </svg>
                            <p className="text-sm text-genq-800">{q.explanation}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
                    q.autoGrade === false ? "bg-amber-50 text-amber-600"
                    : q.isCorrect ? "bg-accent-50 text-accent-600"
                    : "bg-red-50 text-red-600"
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
        className="flex flex-wrap gap-3 mt-8 justify-center">
        <button onClick={() => navigate(`/quiz/${id}?mode=view`)} className="btn-secondary text-sm flex items-center gap-2">
          <Eye className="w-4 h-4" /> ดูข้อสอบพร้อมเฉลย
        </button>
        <button onClick={() => navigate(`/quiz/${id}`)} className="btn-primary text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> ทำอีกครั้ง
        </button>
        <button onClick={() => navigate("/")} className="btn-secondary text-sm flex items-center gap-2">
          <Home className="w-4 h-4" /> กลับหน้าแรก
        </button>
      </motion.div>
    </div>
  );
}
