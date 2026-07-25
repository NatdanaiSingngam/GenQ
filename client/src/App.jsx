import { Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import Navbar from "./components/Navbar";
import LoadingPage from "./components/LoadingPage";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

const Landing = lazy(() => import("./pages/Landing"));
const QuizConfig = lazy(() => import("./pages/QuizConfig"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Results = lazy(() => import("./pages/Results"));
const History = lazy(() => import("./pages/History"));

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Suspense fallback={<LoadingPage />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/config" element={<QuizConfig />} />
                <Route path="/quiz/:id" element={<Quiz />} />
                <Route path="/results/:id" element={<Results />} />
                <Route path="/history" element={<History />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}
