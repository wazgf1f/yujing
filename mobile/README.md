# 语镜 · 移动版（安卓）

移动端语镜：输入一句外语，选对象/场合，AI 从「语法 · 地道 · 得体 · 改写」四层帮你打磨成母语者表达。

## 两种用法

### 方式一：手机浏览器直接用（最快，零配置）
把 index.html 发到手机，用浏览器打开即可（Chrome / Edge / 微信内置浏览器均可）。

### 方式二：打包成安卓 APK（Capacitor）
1. 本机装好 Node.js 和 Android Studio（含 Android SDK）
2. 在本目录执行：
   npm install
   npx cap add android
   npx cap sync
   npx cap open android
3. 在 Android Studio 里点 Build → Build Bundle(s) / APK(s)

## 免费 AI（不用 DeepSeek）

内置三个免费源，在「⚙️ 设置」里选一个、填 API Key 即可：

| 源 | 模型 | 免费情况 | 获取 Key |
|---|---|---|---|
| 智谱 GLM | glm-4-flash | 完全免费 | open.bigmodel.cn |
| Groq | llama-3.3-70b-versatile | 免费额度、超快 | console.groq.com |
| 硅基流动 | Qwen2.5-7B-Instruct | 免费额度 | cloud.siliconflow.cn |

> 三者均支持浏览器直连（已实测 CORS 通过），无需自建服务器。

## 说明

- 设置（含 API Key）保存在手机本地 localStorage，退出不丢。
- 支持流式输出，四层结果逐层弹出。
- 也可手动填任意 OpenAI 兼容接口的 Base URL + 模型名 + Key。
