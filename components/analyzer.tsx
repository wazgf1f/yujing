"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  CalendarDays,
  CheckCircle2,
  Cloud,
  Download,
  Gem,
  HardDrive,
  Languages,
  Loader2,
  PenLine,
  RotateCcw,
  Send,
  Server,
  Settings2,
  ShieldAlert,
  Sparkles,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const LANGS = ["英语", "日语", "韩语"] as const;
type Lang = (typeof LANGS)[number];
const AUDIENCES = ["老师", "同学", "陌生人", "长辈"] as const;
type Audience = (typeof AUDIENCES)[number];
const OCCASIONS = ["正式", "半正式", "日常"] as const;
type Occasion = (typeof OCCASIONS)[number];
const TRANS_LANGS = ["中文", "英语", "日语", "韩语", "俄语"] as const;
type TransLang = (typeof TRANS_LANGS)[number];

type SectionKey = "grammar" | "natural" | "polite" | "rewrite";
type Backend = "cloud" | "local";

const ORDER: SectionKey[] = ["grammar", "natural", "polite", "rewrite"];

const LOCAL_TIERS = [
  { id: "deepseek-r1:7b", label: "7B", tag: "快速版", desc: "约 4.7GB · 普通电脑可跑 · 响应快", icon: Zap },
  { id: "deepseek-r1:14b", label: "14B", tag: "增强版", desc: "约 9GB · 判断更准 · 需更多内存", icon: Gem },
];

function parseSections(text: string): Partial<Record<SectionKey, string>> {
  const out: Partial<Record<SectionKey, string>> = {};
  const re = /##\s*(语法|地道|得体|改写)/g;
  const map: Record<string, SectionKey> = {
    语法: "grammar",
    地道: "natural",
    得体: "polite",
    改写: "rewrite",
  };
  const hits: { key: SectionKey; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    hits.push({ key: map[m[1]], start: m.index, end: re.lastIndex });
  }
  hits.forEach((hit, i) => {
    const start = hit.end;
    const end = i + 1 < hits.length ? hits[i + 1].start : text.length;
    out[hit.key] = text.slice(start, end).replace(/^\s*\n?/, "").trim();
  });
  return out;
}

interface SectionDef {
  key: SectionKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  bar: string;
  iconWrap: string;
  iconColor: string;
  border: string;
  glow: string;
}

const SECTIONS: SectionDef[] = [
  { key: "grammar", title: "语法", subtitle: "有没有错", icon: CheckCircle2, bar: "bg-emerald-500", iconWrap: "bg-emerald-50", iconColor: "text-emerald-600", border: "border-emerald-100", glow: "hover:shadow-emerald-100" },
  { key: "natural", title: "地道", subtitle: "像不像母语者", icon: Sparkles, bar: "bg-blue-500", iconWrap: "bg-blue-50", iconColor: "text-blue-600", border: "border-blue-100", glow: "hover:shadow-blue-100" },
  { key: "polite", title: "得体", subtitle: "语境合不合适", icon: ShieldAlert, bar: "bg-amber-500", iconWrap: "bg-amber-50", iconColor: "text-amber-600", border: "border-amber-100", glow: "hover:shadow-amber-100" },
  { key: "rewrite", title: "母语者改写", subtitle: "更地道的说法", icon: PenLine, bar: "bg-violet-500", iconWrap: "bg-violet-50", iconColor: "text-violet-600", border: "border-violet-100", glow: "hover:shadow-violet-100" },
];

const PRESETS: { lang: Lang; audience: Audience; occasion: Occasion; text: string }[] = [
  { lang: "英语", audience: "老师", occasion: "正式", text: "I require you to respond to me immediately." },
  { lang: "日语", audience: "同学", occasion: "日常", text: "かしこまりました。" },
  { lang: "韩语", audience: "陌生人", occasion: "日常", text: "밥 먹었어?" },
];

type Status = "idle" | "loading" | "done" | "error";

function tierShort(model: string): string {
  if (model.indexOf("14b") >= 0) return "14B";
  if (model.indexOf("7b") >= 0) return "7B";
  return model;
}

export function Analyzer() {
  const [lang, setLang] = useState<Lang>("英语");
  const [audience, setAudience] = useState<Audience>("老师");
  const [occasion, setOccasion] = useState<Occasion>("正式");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [sections, setSections] = useState<Partial<Record<SectionKey, string>>>({});
  const [active, setActive] = useState<SectionKey | null>(null);
  const [error, setError] = useState("");
  const [backend, setBackend] = useState<Backend>("cloud");
  const [apiKey, setApiKey] = useState("");
  const [localModel, setLocalModel] = useState("deepseek-r1:7b");
  const [mode, setMode] = useState<"diagnose" | "translate">("diagnose");
  const [srcLang, setSrcLang] = useState<TransLang>("中文");
  const [tgtLang, setTgtLang] = useState<TransLang>("英语");
  const [translation, setTranslation] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setBackend(window.localStorage.getItem("yujing_backend") === "local" ? "local" : "cloud");
    setApiKey(window.localStorage.getItem("yujing_api_key") || "");
    setLocalModel(window.localStorage.getItem("yujing_local_model") || "deepseek-r1:7b");
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s && (s.backend || s.apiKey || s.localModel)) {
          if (s.backend) setBackend(s.backend);
          if (s.apiKey) setApiKey(s.apiKey);
          if (s.localModel) setLocalModel(s.localModel);
        }
      })
      .catch(() => {});
  }, []);

  function reset() {
    abortRef.current?.abort();
    setSections({});
    setActive(null);
    setTranslation("");
    setStatus("idle");
    setError("");
  }

  async function analyze() {
    if (!input.trim() || status === "loading") return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setError("");
    setSections({});
    setActive(null);
    setStatus("loading");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.trim(), lang, audience, occasion, backend, apiKey, localModel }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || "请求失败（" + res.status + "）");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("浏览器不支持流式读取");

      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const parsed = parseSections(full);
        setSections(parsed);
        const current = [...ORDER].reverse().find((k) => parsed[k]);
        setActive(current ?? null);
      }

      setStatus("done");
      setActive(null);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "分析失败，请重试");
      setStatus("error");
    }
  }

  async function translate() {
    if (!input.trim() || status === "loading") return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setError("");
    setTranslation("");
    setStatus("loading");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.trim(), mode: "translate", sourceLang: srcLang, targetLang: tgtLang, backend, apiKey, localModel }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || "翻译失败（" + res.status + "）");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("浏览器不支持流式读取");

      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setTranslation(full);
      }

      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "翻译失败，请重试");
      setStatus("error");
    }
  }

  const backendReady = backend === "local" || !!apiKey;
  const backendLabel =
    backend === "local" ? "本地 · " + tierShort(localModel) : apiKey ? "云端 · 已设置 Key" : "云端 · 设置 Key";

  return (
    <div className="w-full space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="rounded-3xl border border-zinc-200/70 bg-white/80 p-5 shadow-[0_24px_70px_-40px_rgba(24,24,27,0.5)] backdrop-blur-xl sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex rounded-xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setMode("diagnose")}
              className={cn("rounded-lg px-3.5 py-1.5 text-sm font-medium transition", mode === "diagnose" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500")}
            >
              诊断
            </button>
            <button
              type="button"
              onClick={() => setMode("translate")}
              className={cn("rounded-lg px-3.5 py-1.5 text-sm font-medium transition", mode === "translate" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500")}
            >
              翻译
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-3 py-1.5 text-xs font-medium transition hover:scale-105",
              backendReady
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-amber-200 bg-amber-50 text-amber-600",
            )}
          >
            <Settings2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{backendLabel}</span>
          </button>
        </div>

        {mode === "diagnose" ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field icon={Languages} label="目标语言">
                <Segmented options={LANGS} value={lang} onChange={setLang} />
              </Field>
              <Field icon={CalendarDays} label="场合">
                <Segmented options={OCCASIONS} value={occasion} onChange={setOccasion} />
              </Field>
            </div>

            <div className="mt-5">
              <Field icon={Users} label="交流对象">
                <Segmented options={AUDIENCES} value={audience} onChange={setAudience} />
              </Field>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field icon={Languages} label="源语言">
                <Segmented options={TRANS_LANGS} value={srcLang} onChange={setSrcLang} />
              </Field>
              <Field icon={Sparkles} label="目标语言">
                <Segmented options={TRANS_LANGS} value={tgtLang} onChange={setTgtLang} />
              </Field>
            </div>
          </>
        )}

        <div className="relative mt-5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder={mode === "translate" ? "输入要翻译的文本…" : "用" + lang + "写一句你想说的话…"}
            className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50/60 px-4 py-3.5 pr-10 text-[15px] leading-relaxed text-zinc-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          {input && (
            <button
              type="button"
              aria-label="清空"
              onClick={() => setInput("")}
              className="absolute right-3 top-3 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {mode === "diagnose" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">试试示例：</span>
          {PRESETS.map((p) => (
            <button
              key={p.lang}
              type="button"
              onClick={() => {
                setLang(p.lang);
                setAudience(p.audience);
                setOccasion(p.occasion);
                setInput(p.text);
              }}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
            >
              {p.lang} · {p.audience} · {p.occasion}
            </button>
          ))}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={mode === "translate" ? translate : analyze}
            disabled={!input.trim() || status === "loading"}
            className="animate-pulse-glow inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === "translate" ? "正在翻译…" : "正在诊断…"}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {mode === "translate" ? "翻译" : "一键诊断"}
              </>
            )}
          </button>

          {(status === "done" || status === "error" || sections.grammar || translation) && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-zinc-500 transition hover:text-zinc-700"
            >
              <RotateCcw className="h-4 w-4" />
              重新分析
            </button>
          )}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-600">
                {error}
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  打开模型设置
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="space-y-3">
        {mode === "translate" ? (
          <TranslationCard text={translation} isStreaming={status === "loading"} />
        ) : (
          SECTIONS.map((s, i) => (
            <FeedbackCard
              key={s.key}
              def={s}
              index={i}
              text={sections[s.key]}
              isActive={active === s.key}
              isStreaming={status === "loading"}
            />
          ))
        )}

        {showSettings && (
          <SettingsModal
            initialBackend={backend}
            initialKey={apiKey}
            initialModel={localModel}
            onSave={(b, k, m) => {
              window.localStorage.setItem("yujing_backend", b);
              window.localStorage.setItem("yujing_api_key", k.trim());
              window.localStorage.setItem("yujing_local_model", m.trim());
              setBackend(b);
              setApiKey(k.trim());
              setLocalModel(m.trim());
              setShowSettings(false);
              fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ backend: b, apiKey: k.trim(), localModel: m.trim() }),
              }).catch(() => {});
            }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
            value === o
              ? "bg-zinc-900 text-white shadow-md"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function FeedbackCard({
  def,
  text,
  isActive,
  isStreaming,
  index,
}: {
  def: SectionDef;
  text?: string;
  isActive: boolean;
  isStreaming: boolean;
  index: number;
}) {
  const Icon = def.icon;
  const showSkeleton = isStreaming && !text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 * index, duration: 0.4, ease: "easeOut" }}
      className={cn(
        "relative flex gap-4 rounded-2xl border bg-white/90 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        def.border,
        def.glow,
        isActive && "ring-2 ring-indigo-200",
      )}
    >
      <div className={cn("w-1 shrink-0 self-stretch rounded-full", def.bar)} />
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", def.iconWrap)}>
        <Icon className={cn("h-5 w-5", def.iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">{def.title}</h3>
          <span className="text-xs text-zinc-400">{def.subtitle}</span>
        </div>
        <div className="mt-1.5 text-[15px] leading-relaxed text-zinc-700">
          {text ? (
            <p className="whitespace-pre-wrap">
              {text}
              {isActive && <Cursor />}
            </p>
          ) : showSkeleton ? (
            <Skeleton />
          ) : (
            <p className="text-zinc-300">等待分析…</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TranslationCard({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative flex gap-4 rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm backdrop-blur"
    >
      <div className="w-1 shrink-0 self-stretch rounded-full bg-indigo-500" />
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
        <Sparkles className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">翻译结果</h3>
        </div>
        <div className="mt-1.5 text-[15px] leading-relaxed text-zinc-700">
          {text ? (
            <p className="whitespace-pre-wrap">
              {text}
              {isStreaming && <Cursor />}
            </p>
          ) : isStreaming ? (
            <Skeleton />
          ) : (
            <p className="text-zinc-300">等待翻译…</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Cursor() {
  return (
    <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-indigo-500 align-middle" />
  );
}

function Skeleton() {
  return (
    <div className="space-y-2 py-0.5">
      <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-100" />
      <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
    </div>
  );
}

function SettingsModal({
  initialBackend,
  initialKey,
  initialModel,
  onSave,
  onClose,
}: {
  initialBackend: Backend;
  initialKey: string;
  initialModel: string;
  onSave: (backend: Backend, key: string, model: string) => void;
  onClose: () => void;
}) {
  const [backend, setBackend] = useState<Backend>(initialBackend);
  const [key, setKey] = useState(initialKey);
  const [model, setModel] = useState(initialModel);
  const [checking, setChecking] = useState(false);
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState("");
  const autoPulledRef = useRef(false);

  async function checkOllama() {
    setChecking(true);
    try {
      const r = await fetch("/api/ollama/models");
      const data = await r.json();
      const running = !!data.running;
      const models: string[] = data.models || [];
      setOllamaRunning(running);
      setInstalled(models);
      if (running && models.indexOf(model) < 0 && !autoPulledRef.current && !pulling) {
        autoPulledRef.current = true;
        pull(model);
      }
    } catch {
      setOllamaRunning(false);
      setInstalled([]);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (backend === "local") {
      autoPulledRef.current = false;
      checkOllama();
    }
  }, [backend]);

  function translateStatus(s: string): string {
    if (s.indexOf("manifest") >= 0) return "获取模型清单…";
    if (s.indexOf("pulling") === 0) return "下载模型层中…";
    if (s.indexOf("verifying") >= 0) return "校验中…";
    if (s.indexOf("writing") >= 0) return "写入中…";
    if (s === "success") return "完成";
    return s;
  }

  async function pull(modelName: string) {
    setPulling(true);
    setPullStatus("连接 Ollama…");
    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || "下载失败");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取下载流");
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try {
            const j = JSON.parse(t);
            if (j.status === "done") setPullStatus("完成");
            else setPullStatus(translateStatus(j.status));
          } catch {}
        }
      }
      await checkOllama();
    } catch (e) {
      setPullStatus("下载失败：" + (e as Error).message);
    } finally {
      setPulling(false);
    }
  }

  function selectTier(id: string) {
    setModel(id);
    if (ollamaRunning && installed.indexOf(id) < 0 && !pulling) {
      pull(id);
    }
  }

  const modelReady = installed.indexOf(model) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-zinc-900">模型设置</h2>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBackend("cloud")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
              backend === "cloud"
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-zinc-200 text-zinc-500 hover:bg-zinc-50",
            )}
          >
            <Cloud className="h-4 w-4" />
            DeepSeek 云端
          </button>
          <button
            type="button"
            onClick={() => setBackend("local")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
              backend === "local"
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-zinc-200 text-zinc-500 hover:bg-zinc-50",
            )}
          >
            <HardDrive className="h-4 w-4" />
            本地模型
          </button>
        </div>

        {backend === "cloud" ? (
          <>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              使用 DeepSeek 官方 API（需联网，消耗你的 API 余额）。Key 只保存在本机。
            </p>
            <input
              type="password"
              autoFocus
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-..."
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </>
        ) : (
          <>
            <p className="mt-3 text-xs font-medium text-zinc-500">选择本地模型档位（DeepSeek-R1）：</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {LOCAL_TIERS.map((t) => {
                const Icon = t.icon;
                const selected = model === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTier(t.id)}
                    className={cn(
                      "relative rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5",
                      selected
                        ? "border-indigo-400 bg-indigo-50 shadow-md ring-2 ring-indigo-200"
                        : "border-zinc-200 bg-white hover:shadow-md",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn("h-4 w-4", selected ? "text-indigo-600" : "text-zinc-400")} />
                      <span className="text-base font-bold text-zinc-900">{t.label}</span>
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">{t.tag}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-zinc-500">{t.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
              {checking ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  正在检查 Ollama…
                </div>
              ) : ollamaRunning === false ? (
                <div className="text-xs text-zinc-600">
                  <div className="flex items-center gap-1.5 font-medium text-amber-600">
                    <Server className="h-3.5 w-3.5" />
                    未检测到 Ollama
                  </div>
                  <p className="mt-1 text-zinc-500">
                    请先安装并启动 Ollama，再回来选择档位。
                    <a
                      href="https://ollama.com/download"
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 font-medium text-indigo-600 underline"
                    >
                      去下载 Ollama
                    </a>
                  </p>
                </div>
              ) : pulling ? (
                <div>
                  <div className="flex items-center gap-2 text-xs text-indigo-600">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {pullStatus}
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                      style={{ width: "50%" }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-400">首次下载约 4.7~9GB，请耐心等待。</p>
                </div>
              ) : modelReady ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  模型已就绪，可直接使用
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Download className="h-3.5 w-3.5" />
                  模型未下载，点击上方档位即可自动下载
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(backend, key, model)}
            disabled={backend === "cloud" ? !key.trim() : false}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </motion.div>
    </div>
  );
}
