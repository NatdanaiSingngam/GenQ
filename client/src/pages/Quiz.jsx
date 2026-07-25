import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Lightbulb,
  Send, RotateCcw, FileText, HelpCircle, AlignLeft, SplitSquareHorizontal,
  Type, Eye, Edit3,
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
  "multiple-choice": "เลือกตอบ",
  "true-false": "ถูก-ผิด",
  completion: "เติมคำ",
  "short-answer": "ตอบสั้น",
  matching: "จับคู่",
  essay: "เขียนตอบ",
};

// ────────────── View Mode Renderer (shows correct answers) ──────────────
function ViewRenderer({ question }) {
  const type = question.type || "multiple-choice";
  const expText = question.explanation;

  const AnswerBadge = () => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-accent-100 text-accent-700 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> เฉลย
    </span>
  );

  switch (type) {
    case "multiple-choice":
    case "true-false":
      return (
        <div className="space-y-2">
          {question.options.map((opt, idx) => {
            const isCorrect = idx === question.correctIndex;
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  isCorrect ? "border-accent-300 bg-accent-50" : "border-gray-100 bg-gray-50"
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                  isCorrect ? "bg-accent-500 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 pt-1">{opt}</span>
                {isCorrect && <CheckCircle2 className="w-5 h-5 text-accent-500 shrink-0 mt-1" />}
              </div>
            );
          })}
          {expText && <ExplanationBox text={expText} />}
        </div>
      );

    case "completion":
    case "short-answer":
      return (
        <div className="p-4 rounded-xl bg-accent-50 border border-accent-200">
          <p className="text-sm font-medium text-gray-500 mb-1">
            <AnswerBadge /> คำตอบที่ถูกต้อง:
          </p>
          <p className="text-lg font-semibold text-genq-700">
            {question.answer || question.acceptableAnswers?.[0] || "-"}
          </p>
          {question.acceptableAnswers?.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {question.acceptableAnswers.map((a, i) => (
                <span key={i} className="px-2 py-0.5 bg-accent-100 text-accent-700 rounded-full text-xs">{a}</span>
              ))}
            </div>
          )}
          {question.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {question.keywords.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 bg-genq-100 text-genq-700 rounded-full text-xs">คีย์: {kw}</span>
              ))}
            </div>
          )}
          {expText && <div className="mt-3"><ExplanationBox text={expText} /></div>}
        </div>
      );

    case "matching":
      const leftCol = question.leftColumn || [];
      const rightCol = question.rightColumn || [];
      const pairs = question.pairs || [];
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            {leftCol.map((item, idx) => {
              const matched = pairs.find((p) => p.left === item.text);
              return (
                <div key={idx} className="contents">
                  <div className="p-3 bg-genq-50 border border-genq-200 rounded-xl text-center font-medium text-genq-800">
                    {item.text}
                  </div>
                  <div className="flex items-center justify-center text-accent-400 font-bold">→</div>
                  <div className="p-3 bg-accent-50 border border-accent-200 rounded-xl text-center font-medium text-accent-700">
                    {matched?.right || rightCol[idx]?.text || "-"}
                  </div>
                </div>
              );
            })}
          </div>
          {expText && <ExplanationBox text={expText} />}
        </div>
      );

    case "essay":
      return (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-700">
            📝 ข้อสอบเขียนตอบ — ให้ตรวจสอบด้วยตัวเอง
          </p>
          {question.guidelines?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {question.guidelines.map((g, i) => (
                <li key={i} className="text-sm text-amber-600">• {g}</li>
              ))}
            </ul>
          )}
          {expText && <div className="mt-3"><ExplanationBox text={expText} /></div>}
        </div>
      );

    default:
      return <p className="text-gray-500">ไม่รองรับประเภทข้อสอบนี้</p>;
  }
}

// ────────────── Take Mode Renderer (interactive) ──────────────
function QuestionRenderer({ question, answers, onAnswer, submitted, explanation }) {
  const qId = question.id;
  const userAnswer = answers[qId];
  const type = question.type || "multiple-choice";

  const setAnswer = (val) => onAnswer(qId, val);

  const isCorrect = explanation?.isCorrect;
  const correctAnswer = explanation?.correctIndex;
  const expText = explanation?.explanation;

  switch (type) {
    case "multiple-choice":
    case "true-false":
      return (
        <div className="space-y-3">
          {question.options.map((opt, idx) => {
            let btnClass = "option-btn";
            if (submitted) {
              if (idx === correctAnswer) btnClass += " option-btn-correct";
              else if (idx === userAnswer && !isCorrect) btnClass += " option-btn-wrong";
            } else if (userAnswer === idx) {
              btnClass += " option-btn-selected";
            }

            return (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setAnswer(idx)}
                className={btnClass}
                disabled={submitted}
              >
                <div className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                    submitted && idx === correctAnswer ? "bg-accent-500 text-white"
                    : submitted && idx === userAnswer && !isCorrect ? "bg-red-500 text-white"
                    : userAnswer === idx ? "bg-genq-500 text-white"
                    : "bg-gray-100 text-gray-500"
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1 pt-1 text-left">{opt}</span>
                  {submitted && idx === correctAnswer && <CheckCircle2 className="w-5 h-5 text-accent-500 shrink-0 mt-1" />}
                  {submitted && idx === userAnswer && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-1" />}
                </div>
              </motion.button>
            );
          })}
          {submitted && expText && <ExplanationBox text={expText} />}
        </div>
      );

    case "completion":
    case "short-answer":
      return (
        <div className="space-y-4">
          <div className="relative">
            {type === "completion" ? (
              <input
                type="text"
                value={userAnswer || ""}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="พิมพ์คำตอบที่นี่..."
                disabled={submitted}
                className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-genq-400 focus:ring-2 focus:ring-genq-100 outline-none transition-all disabled:bg-gray-50"
              />
            ) : (
              <textarea
                value={userAnswer || ""}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="พิมพ์คำตอบสั้นๆ..."
                rows={2}
                disabled={submitted}
                className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-genq-400 focus:ring-2 focus:ring-genq-100 outline-none transition-all resize-none disabled:bg-gray-50"
              />
            )}
          </div>
          {submitted && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-sm font-medium text-gray-500 mb-1">
                {type === "completion" ? "คำตอบที่ถูกต้อง:" : "คำตอบที่ถูกต้อง:"}
              </p>
              <p className="text-lg font-semibold text-genq-700">
                {explanation?.answer || explanation?.acceptableAnswers?.[0] || "-"}
              </p>
              {explanation?.keywords && explanation.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {explanation.keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-genq-100 text-genq-700 rounded-full text-xs">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
              {expText && <ExplanationBox text={expText} />}
            </div>
          )}
        </div>
      );

    case "matching":
      const leftCol = question.leftColumn || [];
      const rightCol = question.rightColumn || [];
      const pairMap = userAnswer || {};
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            {leftCol.map((item, idx) => (
              <div key={item.id} className="contents">
                <div className="p-3 bg-genq-50 border border-genq-200 rounded-xl text-center font-medium text-genq-800">
                  {item.text}
                </div>
                <div className="flex items-center justify-center text-gray-300 text-lg">—</div>
                <select
                  value={pairMap[item.id] || ""}
                  onChange={(e) => setAnswer({ ...pairMap, [item.id]: e.target.value })}
                  disabled={submitted}
                  className="p-3 border-2 border-gray-200 rounded-xl bg-white focus:border-genq-400 outline-none transition-all disabled:bg-gray-50"
                >
                  <option value="">— เลือก —</option>
                  {rightCol.map((r) => (
                    <option key={r.id} value={r.text}>{r.text}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {submitted && (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-sm font-medium text-gray-500 mb-2">คำตอบที่ถูกต้อง:</p>
              {explanation?.pairs?.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm mb-1">
                  <span className="font-medium text-genq-700">{p.left}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-genq-600">{p.right}</span>
                </div>
              ))}
              {expText && <ExplanationBox text={expText} />}
            </div>
          )}
        </div>
      );

    case "essay":
      return (
        <div className="space-y-4">
          {question.guidelines?.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-medium text-amber-700 mb-2">📋 แนวทางการตอบ:</p>
              <ul className="space-y-1">
                {question.guidelines.map((g, i) => (
                  <li key={i} className="text-sm text-amber-600 flex items-start gap-2">
                    <span className="mt-1">•</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <textarea
            value={userAnswer || ""}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="พิมพ์คำตอบของคุณที่นี่..."
            rows={6}
            disabled={submitted}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-genq-400 focus:ring-2 focus:ring-genq-100 outline-none transition-all resize-y disabled:bg-gray-50"
          />
          {!submitted && <p className="text-xs text-gray-400">ตอบอย่างน้อย 20 ตัวอักษร</p>}
          {submitted && expText && <ExplanationBox text={expText} />}
        </div>
      );

    default:
      return <p className="text-gray-500">ไม่รองรับประเภทข้อสอบนี้</p>;
  }
}

function ExplanationBox({ text }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-4 bg-genq-50 border border-genq-200 rounded-xl"
    >
      <div className="flex gap-3">
        <Lightbulb className="w-5 h-5 text-genq-500 shrink-0 mt-0.5" />
        <p className="text-sm text-genq-800 leading-relaxed">{text}</p>
      </div>
    </motion.div>
  );
}

// ────────────── Main Quiz Page ──────────────
export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = searchParams.get("mode") || "view"; // "view" | "take"

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Attempt tracking
  const pastAttempts = useMemo(() => getAttempts(id), [id]);

  // Load quiz
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getQuiz(id);
        setQuiz(data);
      } catch (err) {
        setError(err.response?.data?.error || "ไม่พบข้อสอบนี้");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Reset answers when switching to take mode
  useEffect(() => {
    if (mode === "take") {
      setAnswers({});
      setSubmitted(false);
    }
  }, [mode]);

  // Start taking the quiz
  const handleStartTake = () => {
    setSearchParams({ mode: "take" });
    setCurrentIndex(0);
  };

  const current = quiz?.questions?.[currentIndex];
  const total = quiz?.questionCount || 1;
  const progress = ((currentIndex + 1) / total) * 100;
  const TypeIcon = TYPE_ICONS[current?.type] || HelpCircle;

  const handleAnswer = (qId, value) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleSubmit = async () => {
    const answered = Object.keys(answers).length;
    if (answered < total) {
      if (!confirm(`คุณยังไม่ได้ตอบ ${total - answered} ข้อ แน่ใจหรือว่าต้องการส่ง?`)) return;
    }

    try {
      setSubmitting(true);
      const result = await submitAnswers(id, answers);
      saveAttempt(id, result);
      setAnswers((prev) => ({ ...prev, _results: result }));
      setSubmitted(true);
      setSubmitting(false);
      setTimeout(() => navigate(`/results/${id}`, { state: result }), 800);
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการส่งคำตอบ");
      setSubmitting(false);
    }
  };

  const _results = answers._results;
  const explanation = _results?.questions?.find((q) => q.id === current?.id);

  if (loading && !quiz) return <LoadingPage message="กำลังโหลดข้อสอบ..." />;
  if (error && !quiz) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <XCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">{error}</p>
        <button onClick={() => navigate("/")} className="btn-primary text-sm">กลับหน้าแรก</button>
      </div>
    );
  }

  const isViewing = mode === "view";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-800 truncate">{quiz?.title || "ข้อสอบ"}</h1>
            <p className="text-sm text-gray-400 truncate">{quiz?.source || ""}</p>
          </div>

          {/* Mode switch button */}
          {isViewing ? (
            <button onClick={handleStartTake}
              className="flex items-center gap-1.5 px-3 py-2 bg-genq-600 text-white text-sm font-medium rounded-xl hover:bg-genq-700 transition-colors shrink-0"
            >
              <Edit3 className="w-4 h-4" /> เริ่มทำข้อสอบ
            </button>
          ) : (
            <button onClick={() => { setSearchParams({ mode: "view" }); setAnswers({}); setSubmitted(false); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors shrink-0"
            >
              <Eye className="w-4 h-4" /> ดูเฉลย
            </button>
          )}
        </div>

        {/* Progress bar (only in take mode) */}
        {!isViewing && (
          <div className="flex items-center gap-4 mt-3">
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-genq-500 to-accent-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-sm font-medium text-gray-500 shrink-0">
              {currentIndex + 1} / {total}
            </span>
          </div>
        )}

        {/* Past attempts summary */}
        {pastAttempts.length > 0 && isViewing && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">ทำไปแล้ว {pastAttempts.length} ครั้ง</span>
            <span className="text-gray-300">|</span>
            <span>ล่าสุด: <span className="font-semibold text-genq-600">{pastAttempts[pastAttempts.length - 1].score}%</span></span>
            <span className="text-gray-300">|</span>
            <span>ดีที่สุด: <span className="font-semibold text-accent-600">
              {Math.max(...pastAttempts.map((a) => a.score))}%
            </span></span>
          </div>
        )}
      </motion.div>

      {/* View Mode: show all questions with answers */}
      {isViewing ? (
        <div className="space-y-6">
          {quiz?.questions?.map((q, idx) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="card"
            >
              {/* Question header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="w-8 h-8 bg-genq-100 text-genq-700 font-bold rounded-lg flex items-center justify-center text-sm">
                  {idx + 1}
                </span>
                <span className="text-sm text-gray-400">ข้อ</span>
                {q.type && (
                  <span className="ml-auto px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs flex items-center gap-1.5">
                    {(() => { const I = TYPE_ICONS[q.type] || HelpCircle; return <I className="w-3 h-3" />; })()}
                    {TYPE_LABELS[q.type] || q.type}
                  </span>
                )}
              </div>

              {/* Question text */}
              <h2 className="text-xl font-semibold text-gray-800 leading-relaxed mb-4">
                {q.question}
              </h2>

              {/* Correct answer display */}
              <ViewRenderer question={q} />
            </motion.div>
          ))}
        </div>
      ) : (
        <>
          {/* Take Mode: one question at a time */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.2 }}
            >
              <div className="card mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-8 h-8 bg-genq-100 text-genq-700 font-bold rounded-lg flex items-center justify-center text-sm">
                    {currentIndex + 1}
                  </span>
                  <span className="text-sm text-gray-400">ข้อ</span>
                  {current?.type && (
                    <span className="ml-auto px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs flex items-center gap-1.5">
                      <TypeIcon className="w-3 h-3" />
                      {TYPE_LABELS[current.type] || current.type}
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-semibold text-gray-800 leading-relaxed mb-6">
                  {current?.question}
                </h2>

                {current && (
                  <QuestionRenderer
                    question={current}
                    answers={answers}
                    onAnswer={handleAnswer}
                    submitted={submitted}
                    explanation={explanation}
                  />
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {submitted && _results?.pendingCount > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm text-center">
              📝 มี {_results.pendingCount} ข้อที่ต้องรอการตรวจ (Essay)
            </div>
          )}

          {error && quiz && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <div>
              {currentIndex > 0 && (
                <button onClick={() => setCurrentIndex((i) => i - 1)} className="btn-secondary text-sm flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> ข้อก่อนหน้า
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {currentIndex === total - 1 && !submitted && (
                <button onClick={handleSubmit} className="btn-primary text-sm flex items-center gap-2" disabled={submitting}>
                  {submitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  ส่งคำตอบ
                </button>
              )}
              {currentIndex < total - 1 && (
                <button onClick={() => setCurrentIndex((i) => i + 1)} className="btn-primary text-sm flex items-center gap-2">
                  ข้อถัดไป <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {submitted && (
                <button onClick={() => navigate(`/results/${id}`)} className="btn-primary text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> ดูผลลัพธ์
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
