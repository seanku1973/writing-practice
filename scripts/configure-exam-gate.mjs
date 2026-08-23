import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

const envPath = path.resolve(process.cwd(), ".env.local");
const rl = readline.createInterface({ input, output });

function upsertEnv(text, key, value) {
  const line = `${key}=${value}`;
  const expression = new RegExp(
    `^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=.*$`,
    "m"
  );

  if (expression.test(text)) {
    return text.replace(expression, line);
  }

  const suffix =
    text.length === 0 || text.endsWith("\n") ? "" : "\n";

  return `${text}${suffix}${line}\n`;
}

try {
  console.log("");
  console.log("Writing Practice — 現場考試監考密碼設定");
  console.log("--------------------------------------");
  console.log(
    "密碼只會以 scrypt 雜湊寫入 .env.local，不會放進前端程式。"
  );
  console.log("");

  const password = await rl.question("請設定監考老師密碼：");
  const confirm = await rl.question("請再次輸入監考老師密碼：");

  if (!password || password.length < 6) {
    throw new Error("監考密碼至少需要 6 個字元。");
  }

  if (password !== confirm) {
    throw new Error("兩次密碼輸入不一致。");
  }

  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);

  // Use ':' instead of '$' because Next.js .env loading performs
  // variable expansion and can interpret '$...' as an environment variable.
  const storedHash = [
    "scrypt",
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join(":");

  const gateSecret = crypto.randomBytes(48).toString("base64url");

  let envText = "";

  try {
    envText = await fs.readFile(envPath, "utf8");
  } catch {
    envText = "";
  }

  envText = upsertEnv(
    envText,
    "EXAM_PROCTOR_PASSWORD_HASH",
    storedHash
  );

  envText = upsertEnv(
    envText,
    "EXAM_GATE_SECRET",
    gateSecret
  );

  envText = upsertEnv(
    envText,
    "EXAM_GATE_TTL_SECONDS",
    "600"
  );

  await fs.writeFile(envPath, envText, "utf8");

  console.log("");
  console.log("✓ 已更新 .env.local");
  console.log("✓ 監考授權有效時間：10 分鐘");
  console.log("");
  console.log(
    "請重新啟動 npm run dev -- -p 3001，讓新的環境變數生效。"
  );
} catch (error) {
  console.error("");
  console.error(
    `設定失敗：${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exitCode = 1;
} finally {
  rl.close();
}
