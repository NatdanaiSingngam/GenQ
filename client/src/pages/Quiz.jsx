import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Send,
  RotateCcw,
  FileText,
} from "lucide-react";
import { getQuiz, submitAnswers } from "../api/client";
import LoadingPage from "../components/LoadingPage";

export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [correctMap, setCorrectMap] = useState({});
  const [explanations, setExplanations] = useState({});

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

  const current = quiz?.questions?.[currentIndex];
  const total = quiz?.questionCount || 1;
  const progress = ((currentIndex + 1) / total) * 100;

  const handleSelect = (optionIndex) => {
    if (submitted) return; // Lock after submit
    const qId = current.id;

    // Toggle: if same option selected, deselect
    if (answers[qId] === optionIndex) {
      const newAnswers = { ...answers };
      delete newAnswers[qId];
      setAnswers(newAnswers);
    } else {
      setAnswers({ ...answers, [qId]: optionIndex });
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < total) {
      const remaining = total - Object.keys(answers).length;
      if (
        !confirm(
          `คุณยังไม่ได้ตอบ ${remaining} ข้อ แน่ใจหรือว่าต้องการส่ง?`
        )
      ) {
        return;
      }
    }

    try {
      setLoading(true);
      const result = await submitAnswers(id, answers);

      // Build correct map and explanations
      const cMap = {};
      const eMap = {};
      result.questions.forEach((q) => {
        cMap[q.id] = q.isCorrect;
        eMap[q.id] = q;
      });
      setCorrectMap(cMap);
      setExplanations(eMap);
      setSubmitted(true);
      setLoading(false);

      // Navigate to results after brief pause
      setTimeout(() => {
        navigate(`/results/${id}`, { state: result });
      }, 1500);
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการส่งคำตอบ");
      setLoading(false);
    }
  };

  const isCorrect = correctMap[current?.id];
  const explanation = explanations[current?.id];
  const userAnswer = answers[current?.id];

  if (loading && !quiz) return <LoadingPage message="กำลังโหลดข้อสอบ..." />;
  if (error && !quiz)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <XCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">{error}</p>
        <button onClick={() => navigate("/")} className="btn-primary text-sm">
          กลับหน้าแรก
        </button>
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Quiz Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800 line-clamp-1">
              {quiz?.title || "ข้อสอบ"}
            </h1>
            <p className="text-sm text-gray-400">
              {quiz?.source || ""}
            </p>
          </div>
        </div>

        {/* Progress bar */}
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
      </motion.div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
        >
          <div className="card mb-4">
            {/* Question number */}
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 bg-genq-100 text-genq-700 font-bold rounded-lg flex items-center justify-center text-sm">
                {currentIndex + 1}
              </span>
              <span className="text-sm text-gray-400">ข้อ</span>
            </div>

            {/* Question text */}
            <h2 className="text-xl font-semibold text-gray-800 leading-relaxed mb-6">
              {current?.question}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {current?.options.map((option, idx) => {
                let btnClass = "option-btn";

                if (submitted) {
                  // Show results
                  if (idx === explanation?.correctIndex && explanation?.isCorrect === false) {
                    // We don't have this case since correctMap is per-question...
                    // Actually let's handle it differently
                  }
                  if (idx === explanation?.correctIndex) {
                    btnClass += " option-btn-correct";
                  } else if (idx === userAnswer && !isCorrect) {
                    btnClass += " option-btn-wrong";
                  }
                } else if (userAnswer === idx) {
                  btnClass += " option-btn-selected";
                }

                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleSelect(idx)}
                    className={btnClass}
                    disabled={submitted}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`
                          w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0
                          ${
                            submitted && idx === explanation?.correctIndex
                              ? "bg-accent-500 text-white"
                              : submitted && idx === userAnswer && !isCorrect
                              ? "bg-red-500 text-white"
                              : userAnswer === idx
                              ? "bg-genq-500 text-white"
                              : "bg-gray-100 text-gray-500"
                          }
                        `}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1 pt-1">{option}</span>
                      {submitted && idx === explanation?.correctIndex && (
                        <CheckCircle2 className="w-5 h-5 text-accent-500 shrink-0 mt-1" />
                      )}
                      {submitted && idx === userAnswer && !isCorrect && (
                        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-1" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Explanation (shown after submit) */}
          <AnimatePresence>
            {submitted && explanation && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card mb-4 border-l-4 border-l-genq-500"
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-genq-100 rounded-xl flex items-center justify-center shrink-0">
                    <Lightbulb className="w-5 h-5 text-genq-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">
                      คำอธิบาย
                    </p>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {explanation.explanation}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <div>
          {currentIndex > 0 && (
            <button
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              ข้อก่อนหน้า
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {/* Submit button */}
          {currentIndex === total - 1 && !submitted && (
            <button
              onClick={handleSubmit}
              className="btn-primary text-sm flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              ส่งคำตอบ
            </button>
          )}

          {/* Next button */}
          {currentIndex < total - 1 && (
            <button
              onClick={() => setCurrentIndex((i) => i + 1)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              ข้อถัดไป
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* View results */}
          {submitted && (
            <button
              onClick={() => navigate(`/results/${id}`)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              ดูผลลัพธ์
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
