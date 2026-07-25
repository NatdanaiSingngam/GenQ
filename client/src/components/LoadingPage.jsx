import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, FileText, Sparkles, BookOpen, Zap } from "lucide-react";

const STATUSES = [
  { text: "กำลังอ่านสไลด์...", icon: FileText },
  { text: "กำลังสกัดเนื้อหาสำคัญ...", icon: Brain },
  { text: "กำลังวิเคราะห์关键词...", icon: Zap },
  { text: "กำลังสร้างข้อสอบ...", icon: Sparkles },
  { text: "กำลังเพิ่มความสนุก...", icon: BookOpen },
];

export default function LoadingPage({ message = "กำลังโหลด..." }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const status = STATUSES[statusIndex % STATUSES.length];

  useEffect(() => {
    if (message !== "กำลังสร้างข้อสอบ...") return;
    const id = setInterval(() => setStatusIndex((i) => i + 1), 2500);
    return () => clearInterval(id);
  }, [message]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      {/* Animated icon */}
      <div className="relative mb-10">
        <motion.div
          className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 rounded-3xl flex items-center justify-center border border-indigo-500/20"
          animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Brain className="w-12 h-12 text-indigo-400" />
        </motion.div>
        <motion.div
          className="absolute -top-2 -right-2 w-8 h-8 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30"
          animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </motion.div>
      </div>

      {/* Status text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={statusIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-lg font-medium text-heading mb-6"
        >
          {message === "กำลังสร้างข้อสอบ..." ? (
            <span className="flex items-center gap-3">
              <status.icon className="w-5 h-5 text-indigo-400" />
              {status.text}
            </span>
          ) : (
            message
          )}
        </motion.p>
      </AnimatePresence>

      {/* Skeleton cards */}
      <div className="w-full max-w-md space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface rounded-2xl border border-surface/50 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-hover animate-pulse" />
              <div className="h-4 bg-hover animate-pulse rounded-lg flex-1" style={{ animationDelay: `${i * 150}ms` }} />
            </div>
            <div className="space-y-2.5">
              <div className="h-4 bg-hover animate-pulse rounded-lg w-full" style={{ animationDelay: `${i * 150}ms` }} />
              <div className="h-4 bg-hover animate-pulse rounded-lg w-3/4" style={{ animationDelay: `${i * 150}ms` }} />
              <div className="h-12 bg-hover animate-pulse rounded-xl w-full" style={{ animationDelay: `${i * 150}ms` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
