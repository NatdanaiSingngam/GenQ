import { Loader2 } from "lucide-react";

export default function LoadingPage({ message = "กำลังโหลด..." }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-16 h-16 bg-genq-100 rounded-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-genq-600 animate-spin" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent-400 rounded-full animate-pulse" />
      </div>
      <p className="text-gray-500 font-medium animate-pulse">{message}</p>
    </div>
  );
}
