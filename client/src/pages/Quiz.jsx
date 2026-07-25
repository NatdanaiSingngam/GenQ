import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Lightbulb,
  Send, RotateCcw, FileText, HelpCircle, AlignLeft, SplitSquareHorizontal,
  Type, Eye, Edit3, Clock, Printer, Award,
} from "lucide-react";
import { getQuiz, submitAnswers } from "../api/client";
import LoadingPage from "../components/LoadingPage";
import { saveAttempt, getAttempts } from "../utils/attempts";

const TYPE_ICONS = {
  "multiple-choice": HelpCircle,
  "true-false": CheckCircle2,
  completion: Type,
  "short-answer": AlignLeft,
  matching: SplitSquareHorizontal,
  essay: FileText,
};
const TYPE_LABELS = {
  "multiple-choice": "เลือกตอบ", "true-false": "ถูก-ผิด", completion: "เติมคำ",
  "short-answer": "ตอบสั้น", matching: "จับคู่", essay: "เขียนตอบ",
};

// ── Instant reveal: shows answer + explanation after selection ──
function InstantReveal({ question, userAnswer }) {
  const type = question.type || "multiple-choice";
  const isCorrect = question.correctIndex === userAnswer;
  const correctText = question.options?.[question.correctIndex];
  const answerText = question.answer || question.acceptableAnswers?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-4 rounded-2xl border overflow-hidden"
    >
      {/* Result badge */}
      <div className={`flex items-center gap-2 mb-3 ${isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
        {isCorrect ? (
          <><CheckCircle2 className="w-5 h-5" /><span className="font-semibold">ถูกต้อง!</span></>
        ) : (
          <><XCircle className="w-5 h-5" /><span className="font-semibold">ผิด</span></>
        )}
      </div>

      {/* Show correct answer */}
      {(type === "multiple-choice" || type === "true-false") && (
        <p className="text-sm text-[#94A3B8] mb-3">
          <span className="text-[#F8FAFC] font-medium">เฉลย: </span>
          {question.correctIndex !== undefined ? String.fromCharCode(65 + question.correctIndex) + ". " + correctText : "-"}
        </p>
      )}
      {(type === "completion" || type === "short-answer") && (
        <p className="text-sm text-[#94A3B8] mb-3">
          <span className="text-[#F8FAFC] font-medium">คำตอบ: </span>
          {answerText || "-"}
        </p>
      )}
      {type === "matching" && question.pairs && (
        <div className="text-sm text-[#94A3B8] mb-3 space-y-1">
          <p className="text-[#F8FAFC] font-medium mb-1">การจับคู่ที่ถูกต้อง:</p>
          {question.pairs.map((p, i) => (
            <p key={i}>{p.left} → <span className="text-indigo-400">{p.right}</span></p>
          ))}
        </div>
      )}

      {/* Explanation */}
      {question.explanation && (
        <div className="flex gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <Lightbulb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-indigo-400 mb-0.5 uppercase tracking-wider">คำอธิบาย</p>
            <p className="text-sm text-[#94A3B8] leading-relaxed">{question.explanation}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Take-mode question (one at a time, instant feedback) ──
function TakeQuestion({ question, onAnswer, answered, revealed }) {
  const type = question.type || "multiple-choice";
  const qId = question.id;

  if (type === "multiple-choice" || type === "true-false") {
    return (
      <div className="space-y-3">
        {question.options.map((opt, idx) => {
          const isSelected = answered === idx;
          const isCorrect = revealed && idx === question.correctIndex;
          const isWrong = revealed && isSelected && !isCorrect;

          let cls = "option-btn";
          if (revealed) {
            if (isCorrect) cls += " option-btn-correct";
            else if (isWrong) cls += " option-btn-wrong";
          } else if (isSelected) {
            cls += " option-btn-selected";
          }

          return (
            <motion.button key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => !revealed && onAnswer(idx)}
              className={cls}
            >
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shrink-0 ${
                  revealed && isCorrect ? "bg-emerald-500/20 text-emerald-400"
                  : revealed && isWrong ? "bg-rose-500/20 text-rose-400"
                  : isSelected ? "bg-indigo-500/20 text-indigo-400"
                  : "bg-[#334155]/50 text-[#64748B]"
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 pt-0.5">{opt}</span>
                {revealed && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                {revealed && isWrong && <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
              </div>
            </motion.button>
          );
        })}
      </div>
    );
  }

  if (type === "completion" || type === "short-answer") {
    return (
      <div className="space-y-4">
        {type === "completion" ? (
          <input type="text" value={answered || ""} onChange={(e) => onAnswer(e.target.value)}
            placeholder="พิมพ์คำตอบ..." disabled={revealed}
            className="input-field text-lg" />
        ) : (
          <textarea value={answered || ""} onChange={(e) => onAnswer(e.target.value)}
            placeholder="พิมพ์คำตอบสั้นๆ..." rows={2} disabled={revealed}
            className="input-field text-lg resize-none" />
        )}
      </div>
    );
  }

  if (type === "matching") {
    const leftCol = question.leftColumn || [];
    const rightCol = question.rightColumn || [];
    const pairMap = answered || {};
    return (
      <div className="space-y-3">
        {leftCol.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center font-medium text-indigo-300">{item.text}</div>
            <div className="text-[#64748B] text-lg">—</div>
            <select value={pairMap[item.id] || ""} onChange={(e) => onAnswer({ ...pairMap, [item.id]: e.target.value })}
              disabled={revealed}
              className="p-3 border-2 border-[#334155] rounded-xl bg-[#1E293B] text-[#F8FAFC] focus:border-indigo-500 outline-none transition-all disabled:opacity-50">
              <option value="">— เลือก —</option>
              {rightCol.map((r) => <option key={r.id} value={r.text}>{r.text}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }

  return <p className="text-[#64748B]">ไม่รองรับประเภทข้อสอบนี้</p>;
}

// ── View-mode: show all questions with reveal toggle ──
function ViewQuestion({ question, showAnswer }) {
  const type = question.type || "multiple-choice";
  if (!showAnswer) {
    return (
      <div className="space-y-2">
        {question.options ? question.options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-[#334155]/30 border border-[#334155]/50">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 bg-[#334155] text-[#64748B]">
              {String.fromCharCode(65 + idx)}
            </span>
            <span className="flex-1">{opt}</span>
          </div>
        )) : (
          <div className="p-3 rounded-xl bg-[#334155]/30 border border-[#334155]/50 text-[#64748B] text-sm italic">
            {type === "completion" || type === "short-answer" ? "(พิมพ์คำตอบ)" : "(จับคู่)"}
          </div>
        )}
      </div>
    );
  }

  // Show answer
  return (
    <div className="space-y-3">
      {question.options && question.options.map((opt, idx) => {
        const isCorrect = idx === question.correctIndex;
        return (
          <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${
            isCorrect ? "border-emerald-500/30 bg-emerald-500/10" : "border-[#334155]/50 bg-[#334155]/20"
          }`}>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
              isCorrect ? "bg-emerald-500/20 text-emerald-400" : "bg-[#334155] text-[#64748B]"
            }`}>
              {String.fromCharCode(65 + idx)}
            </span>
            <span className="flex-1">{opt}</span>
            {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          </div>
        );
      })}
      {(type === "completion" || type === "short-answer") && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-sm font-medium text-[#94A3B8] mb-1">เฉลย: <span className="text-emerald-400 font-semibold">
            {question.answer || question.acceptableAnswers?.[0] || "-"}</span></p>
          {question.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {question.keywords.map((kw, i) => <span key={i} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full text-xs">คีย์: {kw}</span>)}
            </div>
          )}
        </div>
      )}
      {type === "matching" && question.pairs && (
        <div className="space-y-1">
          {question.pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="font-medium text-[#F8FAFC]">{p.left}</span>
              <span className="text-indigo-400">→</span>
              <span className="text-emerald-400">{p.right}</span>
            </div>
          ))}
        </div>
      )}
      {question.explanation && (
        <div className="flex gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <Lightbulb className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-indigo-400 mb-0.5 uppercase tracking-wider">คำอธิบาย</p>
            <p className="text-sm text-[#94A3B8] leading-relaxed">{question.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Quiz Page ──
export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "view";

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({}); // per-question instant reveal
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shownAnswers, setShownAnswers] = useState({});
  const [answersInitialized, setAnswersInitialized] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const DEFAULT_TIMER_MIN = 30;

  const pastAttempts = useMemo(() => getAttempts(id), [id]);

  // Load quiz
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getQuiz(id);
        setQuiz(data);
        if (mode === "view" && data?.questions) {
          const all = {};
          data.questions.forEach((q) => { all[q.id] = true; });
          setShownAnswers(all);
          setAnswersInitialized(true);
        }
      } catch (err) {
        setError(err.response?.data?.error || "ไม่พบข้อสอบนี้");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, mode]);

  // Mode switch
  useEffect(() => {
    if (mode === "take") {
      setAnswers({});
      setRevealed({});
      setSubmitted(false);
      setShownAnswers({});
      if (!timerRef.current) setTimeLeft(DEFAULT_TIMER_MIN * 60);
    }
  }, [mode]);

  // Timer countdown
  useEffect(() => {
    if (mode !== "take" || submitted || timeLeft === null || timeLeft <= 0) return;
    const id2 = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(id2); return 0; }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = id2;
    return () => clearInterval(id2);
  }, [mode, submitted, timeLeft]);

  const formatTime = (s) => {
    if (s === null) return "";
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const current = quiz?.questions?.[currentIndex];
  const total = quiz?.questionCount || 1;
  const progress = ((currentIndex + 1) / total) * 100;
  const currentRevealed = revealed[current?.id];
  const currentAnswer = answers[current?.id];

  const handleAnswer = (value) => {
    if (!current || currentRevealed) return;
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
    setRevealed((prev) => ({ ...prev, [current.id]: true }));
  };

  // Check all answered
  const allAnswered = quiz?.questions?.every((q) => revealed[q.id]) || false;

  const handleSubmit = async () => {
    if (loading || submitting) return;
    try {
      setSubmitting(true);
      const result = await submitAnswers(id, answers);
      saveAttempt(id, result);
      setSubmitted(true);
      setSubmitting(false);
      setTimeout(() => navigate(`/results/${id}`, { state: result }), 600);
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการส่งคำตอบ");
      setSubmitting(false);
    }
  };

  const handleStartTake = () => {
    setSearchParams({ mode: "take" });
    setCurrentIndex(0);
  };

  // Functions needed by timer (defined before the effect)
  const allShown = isViewing && quiz?.questions?.every((q) => shownAnswers[q.id]);
  const isViewing = mode === "view";

  if (loading && !quiz) return <LoadingPage message="กำลังโหลดข้อสอบ..." />;
  if (error && !quiz) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <XCircle className="w-12 h-12 text-rose-400" />
        <p className="text-[#94A3B8]">{error}</p>
        <button onClick={() => navigate("/")} className="btn-primary text-sm">กลับหน้าแรก</button>
      </div>
    );
  }
  if (!quiz) return null;

  const answeredCount = Object.keys(revealed).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-[#334155]/50 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-[#64748B]" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[#F8FAFC] truncate">{quiz?.title}</h1>
            <p className="text-sm text-[#64748B] truncate">{quiz?.source}</p>
          </div>

          {isViewing ? (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => window.print()}
                className="p-2.5 bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] rounded-xl hover:bg-[#334155] transition-all no-print"
                title="พิมพ์ข้อสอบ">
                <Printer className="w-4 h-4" />
              </button>
              <button onClick={handleStartTake}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600 transition-all shrink-0 no-print">
                <Edit3 className="w-4 h-4" /> เริ่มทำข้อสอบ
              </button>
            </div>
          ) : (
            <button onClick={() => { setSearchParams({ mode: "view" }); setAnswers({}); setRevealed({}); setSubmitted(false); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1E293B] border border-[#334155] text-[#94A3B8] text-sm font-medium rounded-xl hover:text-[#F8FAFC] transition-all shrink-0 no-print">
              <Eye className="w-4 h-4" /> ดูเฉลย
            </button>
          )}
        </div>

        {/* Progress + Timer */}
        {!isViewing && (
          <div className="flex items-center gap-4 mt-3">
            <div className="flex-1 bg-[#334155]/50 rounded-full h-1.5 overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
            <span className="text-sm font-medium text-[#64748B] shrink-0">{currentIndex + 1} / {total}</span>
            {timeLeft !== null && (
              <span className={`flex items-center gap-1 text-sm font-medium shrink-0 ${timeLeft < 60 ? "text-rose-400" : "text-[#64748B]"}`}>
                <Clock className="w-4 h-4" />
                {timeLeft <= 0 ? "หมดเวลา" : formatTime(timeLeft)}
              </span>
            )}
          </div>
        )}

        {/* Attempts */}
        {pastAttempts.length > 0 && isViewing && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
            <span className="font-medium">ทำไปแล้ว {pastAttempts.length} ครั้ง</span>
            <span className="text-[#334155]">|</span>
            <span>ล่าสุด: <span className="font-semibold text-indigo-400">{pastAttempts[pastAttempts.length - 1].score}%</span></span>
            <span className="text-[#334155]">|</span>
            <span>ดีที่สุด: <span className="font-semibold text-emerald-400">
              {Math.max(...pastAttempts.map((a) => a.score))}%</span></span>
          </div>
        )}
      </motion.div>

      {/* View Mode */}
      {isViewing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between no-print">
            <p className="text-sm text-[#64748B]">ทั้งหมด {quiz?.questionCount} ข้อ</p>
            <button onClick={() => {
              if (allShown) setShownAnswers({});
              else { const a = {}; quiz?.questions?.forEach((q) => { a[q.id] = true; }); setShownAnswers(a); }
            }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                allShown ? "bg-[#334155]/50 text-[#64748B] hover:bg-[#334155]" : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
              }`}>
              {allShown ? <><XCircle className="w-3.5 h-3.5" /> ซ่อนเฉลยทั้งหมด</> : <><CheckCircle2 className="w-3.5 h-3.5" /> แสดงเฉลยทั้งหมด</>}
            </button>
          </div>

          {quiz?.questions?.map((q, idx) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="card">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 bg-indigo-500/15 text-indigo-400 font-bold rounded-lg flex items-center justify-center text-sm">{idx + 1}</span>
                <span className="text-sm text-[#64748B]">ข้อ</span>
                {q.type && (
                  <span className="ml-auto px-3 py-1 bg-[#334155]/50 text-[#94A3B8] rounded-full text-xs flex items-center gap-1">
                    {(() => { const I = TYPE_ICONS[q.type] || HelpCircle; return <I className="w-3 h-3" />; })()}
                    {TYPE_LABELS[q.type] || q.type}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold text-[#F8FAFC] leading-relaxed mb-4">{q.question}</h2>
              <ViewQuestion question={q} showAnswer={shownAnswers[q.id]} />
              <div className="mt-3 no-print">
                <button onClick={() => setShownAnswers((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    shownAnswers[q.id] ? "bg-[#334155]/50 text-[#64748B] hover:bg-[#334155]" : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
                  }`}>
                  {shownAnswers[q.id] ? <><XCircle className="w-3.5 h-3.5" /> ซ่อนเฉลย</> : <><CheckCircle2 className="w-3.5 h-3.5" /> ดูเฉลย</>}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Take Mode — one question at a time, flashcard style */
        <>
          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div key={currentIndex}
              initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.25 }}
            >
              <div className="card min-h-[320px] flex flex-col">
                {/* Type badge + number */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 bg-indigo-500/15 text-indigo-400 font-bold rounded-lg flex items-center justify-center text-sm">{currentIndex + 1}</span>
                  <span className="text-sm text-[#64748B]">ข้อ</span>
                  {current?.type && (
                    <span className="ml-auto px-3 py-1 bg-[#334155]/50 text-[#94A3B8] rounded-full text-xs flex items-center gap-1">
                      {(() => { const I = TYPE_ICONS[current.type] || HelpCircle; return <I className="w-3 h-3" />; })()}
                      {TYPE_LABELS[current.type] || current.type}
                    </span>
                  )}
                  {/* Answer indicator */}
                  {currentRevealed && (
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full font-medium">ตอบแล้ว</span>
                  )}
                </div>

                {/* Question text */}
                <h2 className="text-xl sm:text-2xl font-semibold text-[#F8FAFC] leading-relaxed mb-6">
                  {current?.question}
                </h2>

                {/* Options area */}
                <div className="flex-1">
                  {current && (
                    <TakeQuestion question={current} onAnswer={handleAnswer} answered={currentAnswer} revealed={currentRevealed} />
                  )}
                </div>

                {/* Instant reveal after answering */}
                {currentRevealed && current && (
                  <InstantReveal question={current} userAnswer={currentAnswer} />
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">{error}</div>}

          {/* Navigation + Submit */}
          <div className="flex items-center justify-between mt-6 no-print">
            <div>
              {currentIndex > 0 && (
                <button onClick={() => setCurrentIndex((i) => i - 1)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1E293B] border border-[#334155] text-[#94A3B8] rounded-xl hover:text-[#F8FAFC] hover:bg-[#334155] transition-all text-sm">
                  <ChevronLeft className="w-4 h-4" /> ข้อก่อนหน้า
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {currentIndex < total - 1 && (
                <button onClick={() => setCurrentIndex((i) => i + 1)}
                  className="btn-primary text-sm flex items-center gap-2">
                  ข้อถัดไป <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {/* Submit always visible when on last question or all answered */}
              {!submitted && (
                <button onClick={handleSubmit} disabled={submitting}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    currentIndex === total - 1 || allAnswered
                      ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/25"
                      : "bg-[#1E293B] text-[#64748B] border border-[#334155] hover:text-[#F8FAFC]"
                  }`}>
                  {submitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  ส่งคำตอบ {answeredCount}/{total}
                </button>
              )}
              {submitted && (
                <button onClick={() => navigate(`/results/${id}`)}
                  className="btn-primary text-sm flex items-center gap-2">
                  <Award className="w-4 h-4" /> ดูผลลัพธ์
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
