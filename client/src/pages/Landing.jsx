import { useState, useCallback, useEffect } from "react";
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
  GraduationCap,
} from "lucide-react";
import { uploadFile, getSeedQuiz } from "../api/client";
import { addToSessionHistory } from "../utils/history";

export default function Landing() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [error, setError] = useState("");

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError("");
      setUploading(true);
      setProcessingStep("📄 กำลังอ่านเนื้อหาจากไฟล์...");

      const steps = [
        { progress: 20, text: "📄 กำลังประมวลผลไฟล์..." },
        { progress: 40, text: "🧠 กำลังวิเคราะห์เนื้อหาด้วย AI..." },
        { progress: 65, text: "✍️ กำลังสร้างข้อสอบ (เลือกตอบ+ถูกผิด+ตอบสั้น)..." },
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
        // Default config: 3 MC + 1 TF + 1 SA
        const defaultConfig = { multipleChoice: 3, trueFalse: 1, shortAnswer: 1 };
        const data = await uploadFile(file, (pct) => {
          const p = Math.round((pct.loaded / pct.total) * 20);
          setUploadProgress(p);
        }, defaultConfig);

        clearInterval(stepTimer);
        setUploadProgress(100);
        setProcessingStep("✅ พร้อมแล้ว! กำลังเปิดข้อสอบ...");

        addToSessionHistory({
          id: data.quizId, title: data.title,
          questionCount: data.questionCount,
          source: file.name, createdAt: new Date().toISOString(),
        });

        setTimeout(() => navigate(`/quiz/${data.quizId}`), 500);
      } catch (err) {
        clearInterval(stepTimer);
        setError(
          err.response?.data?.error ||
          err.message ||
          "เกิดข้อผิดพลาดในการสร้างข้อสอบ กรุณาลองใหม่"
        );
        setUploading(false);
      }
    },
    [navigate]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.ms-powerpoint": [".ppt", ".pptx"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    disabled: uploading,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
  });

  const handleTrySeed = async () => {
    setUploading(true);
    setProcessingStep("🎯 กำลังโหลดข้อสอบตัวอย่าง...");
    try {
      const data = await getSeedQuiz();
      setProcessingStep("✅ พร้อมแล้ว!");
      addToSessionHistory({ id: data.id, title: data.title, questionCount: data.questionCount, source: data.source, createdAt: new Date().toISOString() });
      setTimeout(() => navigate(`/quiz/${data.id}`), 500);
    } catch (err) {
      setError("ไม่สามารถโหลดข้อสอบตัวอย่างได้");
      setUploading(false);
    }
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
                { icon: Target, value: "10 ข้อ", label: "ต่อ 1 ไฟล์" },
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

          {/* Upload Zone */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto"
          >
            <AnimatePresence mode="wait">
              {!uploading ? (
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
                      <span className="px-3 py-1 bg-gray-100 rounded-full">สูงสุด 20MB</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
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
              )}
            </AnimatePresence>

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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6 text-center"
            >
              <button
                onClick={handleTrySeed}
                disabled={uploading}
                className="inline-flex items-center gap-2 text-genq-600 hover:text-genq-700 font-medium text-sm transition-colors group"
              >
                <GraduationCap className="w-4 h-4" />
                <span>หรือลองทําข้อสอบตัวอย่างทันที (ไม่ต้องอัปโหลดไฟล์)</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
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
              { icon: Brain, step: "2", title: "AI สร้างข้อสอบ", desc: "ระบบ AI วิเคราะห์เนื้อหาและสร้างข้อสอบแบบเลือกตอบ ถูกผิด และตอบสั้น พร้อมเฉลย", color: "from-accent-500 to-accent-600" },
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
