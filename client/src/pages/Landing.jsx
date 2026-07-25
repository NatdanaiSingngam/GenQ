import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Brain,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  Zap,
  Clock,
  Target,
  Loader2,
  X,
  Plus,
  Minus,
  Settings2,
  FileCheck,
} from "lucide-react";
import { uploadFile } from "../api/client";
import { addToSessionHistory } from "../utils/history";

const QUESTION_TYPES = [
  { key: "multipleChoice", label: "เลือกตอบ", color: "bg-blue-100 text-blue-700" },
  { key: "trueFalse", label: "ถูก-ผิด", color: "bg-emerald-100 text-emerald-700" },
  { key: "shortAnswer", label: "ตอบสั้น", color: "bg-amber-100 text-amber-700" },
  { key: "completion", label: "เติมคำ", color: "bg-purple-100 text-purple-700" },
  { key: "matching", label: "จับคู่", color: "bg-pink-100 text-pink-700" },
  { key: "essay", label: "เรียงความ", color: "bg-rose-100 text-rose-700" },
];

const TYPE_LABELS = {
  multipleChoice: "เลือกตอบ", trueFalse: "ถูก-ผิด", shortAnswer: "ตอบสั้น",
  completion: "เติมคำ", matching: "จับคู่", essay: "เรียงความ",
};

export default function Landing() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [error, setError] = useState("");

  // Config panel state
  const [configFile, setConfigFile] = useState(null);
  const [questionCounts, setQuestionCounts] = useState({
    multipleChoice: 3, trueFalse: 1, shortAnswer: 1,
    completion: 0, matching: 0, essay: 0,
  });

  const totalQuestions = Object.values(questionCounts).reduce((a, b) => a + b, 0);
  const maxTotal = 40;

  const adjustCount = (key, delta) => {
    setQuestionCounts((prev) => {
      const next = Math.max(0, Math.min(15, (prev[key] || 0) + delta));
      const newTotal = totalQuestions - (prev[key] || 0) + next;
      if (newTotal > maxTotal) return prev; // don't exceed max
      return { ...prev, [key]: next };
    });
  };

  const setCountValue = (key, raw) => {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    setQuestionCounts((prev) => {
      const clamped = Math.min(val, 15);
      const newTotal = totalQuestions - (prev[key] || 0) + clamped;
      if (newTotal > maxTotal) {
        // Cap to max possible while staying ≤ maxTotal
        const maxForThis = Math.max(0, maxTotal - (totalQuestions - (prev[key] || 0)));
        return { ...prev, [key]: Math.min(clamped, maxForThis) };
      }
      return { ...prev, [key]: clamped };
    });
  };

  const onDrop = useCallback(
    (acceptedFiles, fileRejections) => {
      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        const reason = rejection.errors?.[0]?.message || "ไฟล์ไม่ผ่านเงื่อนไข";
        setError(`❌ "${rejection.file?.name || ""}" ${reason}`);
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      setError("");
      setConfigFile(file);
      // Reset counts to defaults
      setQuestionCounts({
        multipleChoice: 3, trueFalse: 1, shortAnswer: 1,
        completion: 0, matching: 0, essay: 0,
      });
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.ms-powerpoint": [".ppt", ".pptx"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024,
    disabled: uploading || !!configFile,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
  });

  const handleGenerate = async () => {
    if (!configFile) return;

    // Validate at least one question type selected
    if (totalQuestions < 1) {
      setError("❌ กรุณาเลือกจำนวนข้อสอบอย่างน้อย 1 ข้อ");
      return;
    }

    setError("");
    setUploading(true);
    setProcessingStep("📄 กำลังอ่านเนื้อหาจากไฟล์...");

    const steps = [
      { progress: 20, text: "📄 กำลังประมวลผลไฟล์..." },
      { progress: 40, text: "🧠 กำลังวิเคราะห์เนื้อหาด้วย AI..." },
      { progress: 65, text: `✍️ กำลังสร้างข้อสอบ ${totalQuestions} ข้อ...` },
      { progress: 85, text: "🎨 กำลังจัดรูปแบบข้อสอบ..." },
    ];

    let stepIndex = 0;
    const stepTimer = setInterval(() => {
      if (stepIndex < steps.length) {
        setProcessingStep(steps[stepIndex].text);
        setUploadProgress(steps[stepIndex].progress);
        stepIndex++;
      }
    }, 800);

    try {
      // Add round counter for question freshness (track per filename)
      const fileKey = `genq_round_${configFile.name}`;
      let round = parseInt(localStorage.getItem(fileKey) || "0", 10) + 1;
      localStorage.setItem(fileKey, String(round));
      const configWithRound = { ...questionCounts, _r: round };

      const data = await uploadFile(configFile, (pct) => {
        setUploadProgress(Math.round((pct.loaded / pct.total) * 20));
      }, configWithRound);

      clearInterval(stepTimer);
      setUploadProgress(100);
      setProcessingStep("✅ พร้อมแล้ว! กำลังเปิดข้อสอบ...");

      addToSessionHistory({
        id: data.quizId, title: data.title,
        questionCount: data.questionCount,
        source: configFile.name, createdAt: new Date().toISOString(),
      });

      setTimeout(() => navigate(`/quiz/${data.quizId}`), 500);
    } catch (err) {
      clearInterval(stepTimer);
      // Try to extract a useful error message
      let msg = err.response?.data?.error || err.response?.data || err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
      // If the response body is plain text (e.g. "error code: 1102"), show user-friendly message
      if (typeof msg === "string" && msg.includes("1102")) {
        msg = "ไฟล์มีขนาดใหญ่เกินไป (🤏 จำกัดที่ 15MB สำหรับบริการฟรี) หรือข้อสอบมากเกินไป กรุณาลดขนาดหรือจำนวนข้อสอบแล้วลองใหม่";
      } else if (typeof msg !== "string") {
        msg = "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่";
      }
      setError(msg);
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setConfigFile(null);
    setError("");
  };

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-genq-600 via-genq-700 to-genq-900 opacity-[0.03]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-genq-400/10 to-transparent rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-20 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-genq-100 rounded-full text-genq-700 text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Active Learning</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
              เปลี่ยนสไลด์
              <br />
              <span className="gradient-text">เป็นข้อสอบ Interactive</span>
              <br />
              ใน 1 นาที
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
              แค่ลากไฟล์ PDF หรือ PowerPoint วางลงมา
              <br className="hidden sm:block" />
              AI จะสร้างข้อสอบพร้อมเฉลยให้คุณทันที — ไม่ต้องเสียเวลาอ่านซ้ำหลายรอบ
            </p>

            <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-10">
              {[
                { icon: Clock, value: "1 นาที", label: "สร้างข้อสอบ" },
                { icon: Brain, value: "80%", label: "อัตราจดจำ (Active Recall)" },
                { icon: Target, value: "100 ข้อ", label: "สูงสุดต่อไฟล์" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-2 text-gray-500"
                >
                  <stat.icon className="w-5 h-5 text-genq-500" />
                  <span className="font-semibold text-gray-900">{stat.value}</span>
                  <span className="text-sm">{stat.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Upload Zone / Config Panel / Uploading */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto"
          >
            <AnimatePresence mode="wait">
              {uploading ? (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card text-center p-12"
                >
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 bg-genq-100 rounded-2xl" />
                    <div className="relative flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 text-genq-600 animate-spin" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent-400 rounded-full animate-pulse" />
                  </div>
                  <p className="text-lg font-semibold text-gray-800 mb-3">{processingStep}</p>
                  <div className="w-full max-w-xs mx-auto bg-gray-100 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-genq-500 to-accent-500 rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-3">{uploadProgress}%</p>
                </motion.div>
              ) : configFile ? (
                <motion.div
                  key="config"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-8"
                >
                  {/* File info */}
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 bg-genq-100 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-genq-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">{configFile.name}</p>
                      <p className="text-sm text-gray-400">
                        {(configFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>

                  {/* Question type selectors */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings2 className="w-5 h-5 text-genq-600" />
                      <h3 className="text-lg font-bold text-gray-800">เลือกประเภทข้อสอบ</h3>
                    </div>

                    <div className="space-y-3">
                      {QUESTION_TYPES.map(({ key, label, color }) => (
                        <div key={key} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
                              {label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => adjustCount(key, -1)}
                              disabled={questionCounts[key] === 0}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                bg-white border border-gray-200 hover:bg-gray-100
                                disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input type="number" min="0" max="30" value={questionCounts[key]}
                              onChange={(e) => setCountValue(key, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="w-14 text-center font-bold text-gray-800 tabular-nums bg-white border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-genq-300 focus:border-genq-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <button
                              onClick={() => adjustCount(key, 1)}
                              disabled={totalQuestions >= maxTotal || questionCounts[key] >= 15}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                bg-white border border-gray-200 hover:bg-gray-100
                                disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total count */}
                  <div className="flex items-center justify-between mb-2 p-3 bg-genq-50 rounded-xl">
                    <span className="text-sm font-medium text-genq-700">รวมทั้งหมด</span>
                    <span className={`font-bold tabular-nums ${totalQuestions === 0 ? "text-red-500" : totalQuestions === maxTotal ? "text-accent-500" : "text-genq-700"}`}>
                      {totalQuestions} / {maxTotal}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-6 text-center">
                    💡 AI อาจสร้างได้น้อยกว่าที่กำหนดถ้าจำนวนข้อเยอะเกินไป
                    <br />แนะนำไม่เกิน 25 ข้อต่อครั้งเพื่อคุณภาพที่ดีที่สุด
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium
                        hover:bg-gray-50 active:scale-[0.98] transition-all duration-150"
                    >
                      ✕ ยกเลิก
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={totalQuestions < 1}
                      className="flex-1 px-4 py-3 bg-genq-600 text-white font-bold rounded-xl
                        hover:bg-genq-700 active:scale-[0.98] transition-all duration-150
                        disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      🚀 สร้างข้อสอบ {totalQuestions} ข้อ
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="dropzone"
                  exit={{ opacity: 0, scale: 0.95 }}
                  {...getRootProps()}
                  className={`
                    relative cursor-pointer rounded-3xl border-2 border-dashed p-12 sm:p-16 text-center
                    transition-all duration-300
                    ${
                      isDragActive || dragOver
                        ? "border-genq-500 bg-genq-50 scale-[1.02] shadow-2xl shadow-genq-500/20"
                        : "border-gray-300 hover:border-genq-400 hover:bg-gray-50/50 hover:shadow-xl"
                    }
                  `}
                >
                  <input {...getInputProps()} />

                  <div className="flex flex-col items-center gap-4">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isDragActive || dragOver
                        ? "bg-genq-500 text-white scale-110 shadow-xl shadow-genq-500/30"
                        : "bg-genq-100 text-genq-600"
                    }`}>
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-800 mb-1">
                        {isDragActive ? "ปล่อยไฟล์ได้เลย!" : "ลากไฟล์มาวางที่นี่"}
                      </p>
                      <p className="text-gray-500 text-sm">หรือคลิกเพื่อเลือกไฟล์</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                      <span className="px-3 py-1 bg-gray-100 rounded-full">PDF</span>
                      <span className="px-3 py-1 bg-gray-100 rounded-full">PPTX</span>
                      <span className="px-3 py-1 bg-gray-100 rounded-full">DOCX</span>
                      <span className="px-3 py-1 bg-gray-100 rounded-full">TXT</span>
                      <span className="px-3 py-1 bg-gray-100 rounded-full">สูงสุด 15MB</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
                >
                  ❌ {error}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20 bg-white/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              วิธีใช้งาน <span className="gradient-text">ง่ายนิดเดียว</span>
            </h2>
            <p className="text-gray-500 text-lg">เพียง 3 ขั้นตอน ก็เปลี่ยนสไลดะของคุณเป็นข้อสอบ Interactive</p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { icon: Upload, step: "1", title: "ลาก & วางไฟล์", desc: "ลากไฟล์สไลด์เรียน PDF หรือ PPTX มาวางบนหน้าเว็บ", color: "from-genq-500 to-genq-600" },
              { icon: Settings2, step: "2", title: "เลือกประเภทข้อสอบ", desc: "เลือกรูปแบบข้อสอบที่ต้องการ ทั้งเลือกตอบ ถูกผิด ตอบสั้น เติมคำ จับคู่ หรือเรียงความ", color: "from-accent-500 to-accent-600" },
              { icon: CheckCircle2, step: "3", title: "ทดสอบ & รู้ผลทันที", desc: "กดเลือกคำตอบ ดูเฉลยและคำอธิบาย รู้จุดอ่อนของตัวเองก่อนสอบ", color: "from-genq-600 to-genq-800" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="card-hover text-center p-8"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-5 shadow-lg`}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-3xl font-black text-genq-200 mb-2">{item.step}</div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-8 items-center"
          >
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                ทำไมต้อง <span className="gradient-text">GenQ</span>?
              </h2>
              <div className="space-y-4">
                {[
                  { icon: Zap, title: "ประหยัดเวลา 3-5 ชม. ต่อวิชา", desc: "ไม่ต้องเสียเวลาอ่านสไลด์ซ้ำหลายรอบ หรือนั่งทำข้อสอบเอง" },
                  { icon: Brain, title: "Active Recall เพิ่มความจำ 80%", desc: "วิทยาศาสตร์พิสูจน์แล้วว่า การทำข้อสอบช่วยจำได้ดีกว่าอ่านอย่างเดียว" },
                  { icon: Target, title: "รู้จุดอ่อนก่อนเข้าห้องสอบ", desc: "ระบบวิเคราะห์ว่าคุณพลาดตรงไหน พร้อมแนะนำให้กลับไปอ่านสไลด์หน้าไหน" },
                  { icon: Clock, title: "ใช้ได้ทุกที่ ทุกเวลา 24/7", desc: "แค่มีอินเทอร์เน็ต ก็เปลี่ยนสไลด์เป็นข้อสอบได้ทันที" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4 p-4 rounded-xl hover:bg-genq-50 transition-colors"
                  >
                    <div className="w-12 h-12 bg-genq-100 rounded-xl flex items-center justify-center shrink-0">
                      <item.icon className="w-6 h-6 text-genq-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{item.title}</h3>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="card p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-genq-100 to-transparent rounded-bl-full" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <span className="text-sm text-gray-400 ml-2">สไลด์เรียน — ระบบฐานข้อมูล</span>
                  </div>
                  <div className="space-y-3 mb-6">
                    <div className="h-3 bg-gray-200 rounded-full w-full" />
                    <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                    <div className="h-3 bg-gray-200 rounded-full w-5/6" />
                    <div className="h-3 bg-gray-200 rounded-full w-2/3" />
                    <div className="h-3 bg-gray-200 rounded-full w-4/5" />
                  </div>
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="flex items-center justify-center"
                  >
                    <div className="bg-genq-500 text-white text-sm font-medium px-6 py-3 rounded-full shadow-xl shadow-genq-500/30 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>✨ GenQ กำลังสร้างข้อสอบ...</span>
                    </div>
                  </motion.div>
                  <div className="mt-6 space-y-4">
                    {["ข้อ 1", "ข้อ 2", "ข้อ 3"].map((q, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-8 bg-white rounded-lg border border-gray-200" />
                          <div className="h-8 bg-white rounded-lg border border-gray-200" />
                          <div className="h-8 bg-white rounded-lg border border-gray-200" />
                          <div className="h-8 bg-white rounded-lg border border-gray-200" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute -bottom-3 -right-3 bg-accent-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg"
              >
                ⚡ เร็วกว่าอ่านเอง 10 เท่า
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-genq-600 to-genq-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">พร้อมสอบแล้วหรือยัง? 🎯</h2>
            <p className="text-genq-200 text-lg mb-8">
              ไม่ต้องอ่านสไลด์ซ้ำหลายรอบอีกต่อไป
              <br />แค่ลากวาง — แล้วเริ่มสอบได้เลย
            </p>
            <button
              onClick={() => document.getElementById("upload-section")?.scrollIntoView({ behavior: "smooth" })}
              className="px-8 py-4 bg-white text-genq-700 font-bold rounded-2xl hover:bg-genq-50 active:scale-[0.98] transition-all duration-200 shadow-2xl shadow-black/20 text-lg"
            >
              🚀 ลองใช้ฟรีตอนนี้
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
