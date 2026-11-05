import { Sparkles } from "lucide-react";
import { Analyzer } from "@/components/analyzer";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-5 py-12 sm:py-16">
      <header className="mb-10 w-full text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-zinc-500 shadow-sm backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          不止纠语法，更纠「说得不像母语者」
        </div>
        <h1 className="mt-5 bg-[linear-gradient(90deg,#18181b,#4f46e5,#a855f7,#ec4899,#18181b)] bg-clip-text text-5xl font-black tracking-tight text-transparent animate-shimmer sm:text-6xl">
          语镜
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-500">
          输入一句外语，选择对象与场合，AI 从「语法 · 地道 · 得体 · 改写」四层，帮你把话打磨成母语者的表达。
        </p>
      </header>

      <Analyzer />

      <footer className="mt-14 text-center text-xs text-zinc-400">
        语镜 LinguaMirror · 软件学院智应杯 AI 应用大赛 · 赛题三
      </footer>
    </main>
  );
}
