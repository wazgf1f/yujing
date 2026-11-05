"use strict";
const { app, BrowserWindow, shell } = require("electron");
const { startServer } = require("./server");
const fs = require("fs");
const path = require("path");
const os = require("os");

// 启动失败时写错误日志，方便排查（位置：%TEMP%\yujing-error.log）
const LOG = path.join(os.tmpdir(), "yujing-error.log");
function logError(prefix, err) {
  try {
    fs.appendFileSync(LOG, "[" + new Date().toISOString() + "] " + prefix + ": " + ((err && err.stack) || err) + "\n");
  } catch (e) {}
}
process.on("uncaughtException", (e) => logError("uncaughtException", e));
process.on("unhandledRejection", (e) => logError("unhandledRejection", e));

let mainWindow = null;

async function createWindow() {
  let result;
  try {
    result = await startServer({ port: 3210 });
  } catch (e) {
    logError("startServer(3210) 端口占用，改用随机端口", e);
    result = await startServer({ port: 0 });
  }
  const port = result.port;

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 880,
    minWidth: 700,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#f8f9fc",
    title: "语镜 LinguaMirror",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL("http://127.0.0.1:" + port);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow().catch((e) => logError("createWindow", e));
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
