# 语镜 LinguaMirror

> 不止纠语法，更纠「说得不像母语者」—— 面向外语学习者的语境化表达诊断工具。

输入一句外语，选择交流对象与场合，AI 从「语法 · 地道 · 得体 · 改写」四层，帮你把话打磨成母语者的表达。

## 功能特性

- 🧠 **四层诊断**：语法（有没有错）→ 地道（像不像母语者）→ 得体（语境合不合适）→ 母语者改写
- ☁️ **双后端**：DeepSeek 云端 API / 本地 Ollama 大模型
- 📦 **本地模型双档位**：DeepSeek-R1 7B（快速）/ 14B（增强），自动检测 Ollama、自动拉取模型（带进度条）
- ⚡ **流式输出**：四层结果像打字机一样逐层弹出
- 🖥️ **桌面版**：Electron 打包，原生窗口，无需浏览器
- 🎨 **精致 UI**：动态光斑背景、流光标题、呼吸发光按钮、交错动画

## 技术栈

Next.js 15 · TypeScript · Tailwind CSS v4 · Motion · Electron · DeepSeek API · Ollama

## 快速开始（开发）

1. 安装依赖：pnpm install
2. 配置（可选）：复制 .env.example 为 .env.local，填入 DeepSeek API Key
3. 启动：pnpm dev，浏览器打开 http://localhost:3000

> 提示：API Key 也可以直接在页面右上角「模型设置」里填写，不一定要配置 .env 文件。

## 本地模型（Ollama）

1. 安装并启动 Ollama：https://ollama.com/download
2. 页面「模型设置」→「本地模型」，选择档位 7B 或 14B
3. 程序会自动检测 Ollama、自动下载模型（首次约 4.7GB / 9GB）

## 构建桌面版（Electron）

1. 先构建前端静态产物：pnpm build（生成 out 目录）
2. 把 out 目录和 server.js 复制到 electron 目录下
3. 进入 electron 目录：pnpm install，然后 pnpm run dist 打包成 exe

详细步骤见 electron/README.md。

## 目录结构

- app/        —— Next.js 页面（首页、布局、全局样式）
- components/ —— 前端组件（analyzer 主组件）
- lib/        —— 工具函数（cn 等）
- electron/   —— Electron 桌面壳（main.js + 打包配置）
- server.js   —— 零依赖 Node 服务（静态文件 + LLM 流式 + Ollama 管理）

## 作者与致谢

- **作者**：大连外国语大学软件学院 陈肇睿
- **说明**：本软件前端 UI 由本人制作，其余部分交由 DeepSeek 完成，并由本人进行源码的审阅及修改。

## License

MIT
