"use strict";
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "out");
const DEFAULT_CLOUD_BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEFAULT_CLOUD_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEFAULT_LOCAL_BASE = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
const DEFAULT_LOCAL_MODEL = process.env.OLLAMA_MODEL || "deepseek-r1:7b";
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function buildSystemPrompt(lang, audience, occasion) {
  const lines = [
    "你是一位精通" + lang + "及其社会文化习惯的外语教学专家，同时非常熟悉中文母语者在学习" + lang + "时常见的「语用迁移」错误。",
    "",
    "用户会发给你一句" + lang + "文本。请先准确理解这句话的真实意图，再逐层诊断。",
    "",
    "请严格按以下四段输出，每段必须以 \"## 标题\" 这一行开头（标题只能是：语法、地道、得体、改写）。不要输出任何额外说明、寒暄或这四段之外的内容。",
    "",
    "## 语法",
    "判断这句话有没有语法错误。有错就简明指出错误点并给出正确写法；没错就写「语法正确」。",
    "",
    "## 地道",
    "判断这句是否像母语者的自然表达。指出生硬、直译、中式" + lang + "的地方，并说明为什么不自然。",
    "",
    "## 得体",
    "结合语境（对象：" + audience + "；场合：" + occasion + "）判断语用是否得体：敬语/礼貌程度、语气直接程度、文化习惯。若可能冒犯或不合身份，明确指出。",
    "",
    "## 改写",
    "给出 2~3 个母语者会采用的完整替换表达（保留原意），每个后面用括号附一句差异说明。",
    "",
    "要求：每段 2~4 句话，直接、专业、不啰嗦；诊断与解释用中文；「改写」部分保留原句的" + lang + "原文。",
  ];
  return lines.join("\n");
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function streamLLM({ baseUrl, model, apiKey, messages, res }) {
  const isHttps = baseUrl.indexOf("https://") === 0;
  const client = isHttps ? https : http;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;
  const payload = JSON.stringify({ model: model, stream: true, temperature: 0.4, messages: messages });

  const upstream = client.request(
    baseUrl + "/chat/completions",
    { method: "POST", headers: headers },
    (upRes) => {
      if (upRes.statusCode !== 200) {
        let err = "";
        upRes.on("data", (c) => (err += c));
        upRes.on("end", () =>
          sendJson(res, upRes.statusCode || 502, {
            error: "模型接口返回 " + upRes.statusCode + "：" + err.slice(0, 300),
          })
        );
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      });
      let buffer = "";
      upRes.setEncoding("utf8");
      upRes.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (t.indexOf("data:") !== 0) continue;
          const p = t.slice(5).trim();
          if (!p || p === "[DONE]") continue;
          try {
            const json = JSON.parse(p);
            const delta =
              json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
            if (delta) res.write(delta);
          } catch {}
        }
      });
      upRes.on("end", () => res.end());
      upRes.on("error", () => res.end());
    }
  );
  upstream.on("error", () => {
    if (res.headersSent) res.end();
    else sendJson(res, 502, { error: "网络错误：无法连接模型接口，请检查网络" });
  });
  upstream.end(payload);
}

function handleChat(req, res) {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, { error: "请求体不是合法的 JSON" });
    }
    const text = body.text;
    const lang = body.lang || "英语";
    const audience = body.audience || "老师";
    const occasion = body.occasion || "正式";
    if (!text || !text.trim()) {
      return sendJson(res, 400, { error: "请输入要诊断的句子" });
    }

    const messages = [
      { role: "system", content: buildSystemPrompt(lang, audience, occasion) },
      { role: "user", content: text.trim() },
    ];

    if (body.backend === "local") {
      const baseUrl = body.localBaseUrl || DEFAULT_LOCAL_BASE;
      const model = body.localModel || DEFAULT_LOCAL_MODEL;
      return streamLLM({ baseUrl: baseUrl, model: model, apiKey: "", messages: messages, res: res });
    }

    const apiKey = body.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return sendJson(res, 500, {
        error: "未设置 API Key：点击页面右上角「设置」，选择「DeepSeek 云端」并粘贴你的 API Key 即可使用。",
      });
    }
    return streamLLM({ baseUrl: DEFAULT_CLOUD_BASE, model: DEFAULT_CLOUD_MODEL, apiKey: apiKey, messages: messages, res: res });
  });
}

function ollamaRequest(pathname, method, body) {
  return new Promise((resolve, reject) => {
    const url = OLLAMA_BASE + pathname;
    const isHttps = url.indexOf("https://") === 0;
    const client = isHttps ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const req = client.request(
      url,
      {
        method: method || "GET",
        headers: data
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
          : {},
      },
      (r) => {
        let raw = "";
        r.setEncoding("utf8");
        r.on("data", (c) => (raw += c));
        r.on("end", () => resolve({ status: r.statusCode, body: raw }));
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function handleOllamaModels(req, res) {
  ollamaRequest("/api/tags", "GET")
    .then((r) => {
      if (r.status !== 200) {
        return sendJson(res, 200, { running: false, error: "Ollama 返回 " + r.status });
      }
      try {
        const data = JSON.parse(r.body);
        const models = (data.models || []).map((m) => m.name);
        return sendJson(res, 200, { running: true, models: models });
      } catch (e) {
        return sendJson(res, 200, { running: false, error: "解析失败" });
      }
    })
    .catch(() => {
      return sendJson(res, 200, { running: false, error: "Ollama 未运行" });
    });
}

function handleOllamaPull(req, res) {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, { error: "请求体不是合法的 JSON" });
    }
    const model = body.model;
    if (!model) return sendJson(res, 400, { error: "缺少 model 参数" });

    const url = OLLAMA_BASE + "/api/pull";
    const isHttps = url.indexOf("https://") === 0;
    const client = isHttps ? https : http;
    const payload = JSON.stringify({ name: model, stream: true });

    const upstream = client.request(
      url,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (upRes) => {
        if (upRes.statusCode !== 200) {
          let err = "";
          upRes.on("data", (c) => (err += c));
          upRes.on("end", () => sendJson(res, upRes.statusCode || 502, { error: "Ollama 返回 " + upRes.statusCode + "：" + err.slice(0, 200) }));
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        });
        let buffer = "";
        upRes.setEncoding("utf8");
        upRes.on("data", (chunk) => {
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try {
              const j = JSON.parse(t);
              const out = { status: j.status || "" };
              if (j.total) out.total = j.total;
              if (j.completed != null) out.completed = j.completed;
              res.write(JSON.stringify(out) + "\n");
            } catch {}
          }
        });
        upRes.on("end", () => {
          res.write(JSON.stringify({ status: "done" }) + "\n");
          res.end();
        });
        upRes.on("error", () => res.end());
      }
    );
    upstream.on("error", () => {
      if (res.headersSent) res.end();
      else sendJson(res, 502, { error: "无法连接 Ollama" });
    });
    upstream.end(payload);
  });
}

function handler(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    return sendJson(res, 400, { error: "非法请求" });
  }

  if (pathname === "/api/chat") {
    if (req.method === "POST") return handleChat(req, res);
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  if (pathname === "/api/ollama/models") {
    return handleOllamaModels(req, res);
  }

  if (pathname === "/api/ollama/pull") {
    if (req.method === "POST") return handleOllamaPull(req, res);
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  const rel = pathname === "/" ? "index.html" : pathname.substring(1);
  const filePath = path.join(OUT_DIR, rel);
  if (filePath.indexOf(OUT_DIR) !== 0) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (path.extname(rel) === "") {
        fs.readFile(path.join(OUT_DIR, "index.html"), (e2, idx) => {
          if (e2) {
            res.writeHead(404);
            res.end("Not Found");
          } else {
            res.writeHead(200, { "Content-Type": MIME[".html"] });
            res.end(idx);
          }
        });
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function startServer(opts) {
  opts = opts || {};
  const port = opts.port !== undefined ? opts.port : Number(process.env.PORT || 3210);
  const host = opts.host || process.env.HOST || "127.0.0.1";
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve({ server: server, port: server.address().port });
    });
  });
}

module.exports = { startServer: startServer, buildSystemPrompt: buildSystemPrompt };

if (require.main === module) {
  startServer()
    .then((r) => {
      console.log("");
      console.log("  语镜 LinguaMirror 已启动");
      console.log("  → http://127.0.0.1:" + r.port);
      console.log("");
      console.log("  关闭本窗口即可退出。");
    })
    .catch((e) => {
      console.error("启动失败：", e.message);
      process.exit(1);
    });
}
