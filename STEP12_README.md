# Step 12 — 現場監考寫作測驗

新的學生流程：

Student Login
→ `/writing`
→ 選擇 Computer / Paper
→ `/writing/unlock`
→ 監考老師輸入密碼
→ `/writing/select`
→ 選擇 Exercise 01 / 02 / ...
→ `/writing/exam/WT01`
→ 準備開始測驗
→ START
→ 監考授權立即失效
→ 40 分鐘正式測驗

學生不需要老師密碼即可使用：
`/progress`

## 第一次設定

### 1. Supabase SQL Editor 執行
`supabase/step12_proctored_exam.sql`

### 2. Windows CMD 在 writing-practice 專案目錄執行
`node scripts/configure-exam-gate.mjs`

依畫面輸入兩次監考老師密碼。

這個 script 會：
- 使用 scrypt 將密碼雜湊
- 自動產生簽章 secret
- 自動寫入 `.env.local`
- 不會把明碼密碼寫入前端程式

### 3. 重啟 Next.js
先 Ctrl+C，再執行：
`npm run dev -- -p 3001`

## 新增 Exercise 02
之後只需要在：
`lib/writingTests.server.ts`
增加 WT02。

Exercise Selection 頁會自動出現新的 Exercise。

## 監考安全設計
- 學生登入後永遠可以看 Progress。
- 正式考試一定要重新輸入監考老師密碼。
- 密碼不會送進前端 bundle。
- 瀏覽器只得到 HttpOnly signed authorization cookie。
- 授權預設 10 分鐘過期。
- START 後授權立即銷毀；下一次考試必須重新輸入老師密碼。
- 回到 `/writing` 也會清除尚未使用的授權。
- 舊 `/writing/1` 與 `/writing/1/setup` 已改成返回 `/writing`，不能繞過新流程。
- Supabase `writing_tests_authenticated_select` policy 會移除，學生無法在 DevTools 直接查考題。
