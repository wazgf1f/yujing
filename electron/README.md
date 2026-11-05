# 语镜桌面版打包说明

把语镜打包成 Windows 桌面程序（原生窗口，无需浏览器）。

## 前置

- 已运行 pnpm build 生成 out 目录
- electron 目录下已有 out、server.js、main.js、package.json

## 打包步骤

1. 安装依赖：pnpm install
2. 打包：pnpm run dist（调用 electron-packager）

## 产物

dist/语镜-win32-x64/ 目录下的 语镜.exe 即为桌面程序，双击即可运行。

## 说明

- main.js 会启动内置的 server.js（Node 服务）并用 Electron 窗口加载
- 程序支持云端 DeepSeek / 本地 Ollama 两种后端，在界面「模型设置」里切换
