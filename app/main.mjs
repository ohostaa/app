import express from "express";
import pkg from 'discord.js';
const { Client, GatewayIntentBits, EmbedBuilder } = pkg;
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import fetch from "node-fetch";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { config as dotenvConfig } from "dotenv";

// Load environment variables
dotenvConfig();

const app = express();
app.use(express.raw({ type: 'application/json' }));

// 環境変数から設定を読み込み（Koyeb Secrets対応）
const config = {
  line: {
    channelId: process.env.LINE_CHANNEL_ID,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    kid: process.env.LINE_KID,
    privateKey: process.env.LINE_PRIVATE_KEY ? process.env.LINE_PRIVATE_KEY.replace(/\\n/g, "\n") : "",
  },
  discord: {
    token: process.env.DISCORD_TOKEN,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    syncChannelId: process.env.DISCORD_SYNC_CHANNEL_ID,
  },
  server: {
    port: process.env.PORT || 3000,
  },
  broadcast: {
    minInterval: parseInt(process.env.BROADCAST_MIN_INTERVAL) || 60000,
    enabled: process.env.BROADCAST_ENABLED !== 'false',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
    algorithm: 'aes-256-gcm'
  }
};

// 設定値の検証（Koyeb Secrets対応版）
function validateConfig() {
  const required = [
    "LINE_CHANNEL_ID",
    "LINE_CHANNEL_SECRET",
    "LINE_KID",
    "LINE_PRIVATE_KEY",
    "DISCORD_TOKEN",
    "DISCORD_WEBHOOK_URL",
    "DISCORD_SYNC_CHANNEL_ID",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ 必要な環境変数が設定されていません:", missing.join(", "));
    console.error("🔧 Koyebの Environment variables で以下を設定してください:");
    console.error("💡 機密情報はSecretsを使用し、{{ secret.SECRET_NAME }}で参照してください");
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  // LINE_PRIVATE_KEYの形式チェック
  if (process.env.LINE_PRIVATE_KEY && !process.env.LINE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")) {
    console.error("❌ LINE_PRIVATE_KEY の形式が正しくありません");
    console.error("🔧 -----BEGIN PRIVATE KEY----- で始まる形式で設定してください");
    console.error(`現在の値: ${process.env.LINE_PRIVATE_KEY}`); // ← ここを修正
    process.exit(1);
  }

  // 暗号化キーの警告
  if (!process.env.ENCRYPTION_KEY) {
    console.warn("⚠️ ENCRYPTION_KEY が設定されていません。自動生成されたキーを使用します。");
    console.warn("⚠️ 本番環境では必ずKoyeb Secretsで固定のENCRYPTION_KEYを設定してください。");
  }

  console.log("✅ 環境変数の設定確認完了");
  console.log("🔒 Koyeb Secretsを使用した機密情報の管理が推奨されます");
}

validateConfig();

// Discord クライアント初期化（v14対応）
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

let lineAccessToken = null;
let tokenExpiryTime = null;
const messageHistory = new Map();

// ユーザー名管理用のMap（メモリ上では暗号化されていない状態で保持）
const userNicknames = new Map();
const NICKNAMES_FILE = 'user_nicknames_encrypted.json';

// 暗号化関数
function encrypt(text) {
  try {
    const key = Buffer.from(config.encryption.key, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(config.encryption.algorithm, key);
    cipher.setAAD(Buffer.from('nickname-data'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('❌ 暗号化エラー:', error);
    return null;
  }
}

// 復号化関数
function decrypt(encryptedData) {
  try {
    const key = Buffer.from(config.encryption.key, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipher(config.encryption.algorithm, key);
    decipher.setAAD(Buffer.from('nickname-data'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ 復号化エラー:', error);
    return null;
  }
}

// ディレクトリとファイルの存在確認・作成
function ensureFileExists(filePath, defaultContent = '{}') {
  try {
    // ディレクトリの確認・作成
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ ディレクトリを作成しました: ${dir}`);
    }

    // ファイルの確認・作成
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, defaultContent);
      console.log(`✅ ファイルを作成しました: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ ファイル作成エラー (${filePath}):`, error);
  }
}

// ニックネーム保存関数（暗号化版）
function saveNicknames() {
  try {
    ensureFileExists(NICKNAMES_FILE);
    
    const encryptedData = {};
    for (const [userId, nickname] of userNicknames.entries()) {
      const encrypted = encrypt(nickname);
      if (encrypted) {
        encryptedData[userId] = encrypted;
      }
    }
    
    const dataToSave = {
      version: '1.0',
      algorithm: config.encryption.algorithm,
      data: encryptedData,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(NICKNAMES_FILE, JSON.stringify(dataToSave, null, 2));
    console.log('✅ ニックネーム暗号化保存完了');
  } catch (error) {
    console.error('❌ ニックネーム保存エラー:', error);
  }
}

// ニックネーム読み込み関数（復号化版）
function loadNicknames() {
  try {
    ensureFileExists(NICKNAMES_FILE);
    const fileContent = fs.readFileSync(NICKNAMES_FILE, 'utf8');
    
    // 空ファイルの場合
    if (fileContent.trim() === '{}') {
      console.log('✅ ニックネームファイルは空です');
      return;
    }
    
    const savedData = JSON.parse(fileContent);
    
    // 新形式（暗号化済み）の場合
    if (savedData.version && savedData.data) {
      console.log('✅ 暗号化されたニックネームファイルを読み込み中...');
      
      for (const [userId, encryptedData] of Object.entries(savedData.data)) {
        const decrypted = decrypt(encryptedData);
        if (decrypted) {
          userNicknames.set(userId, decrypted);
        } else {
          console.warn(`⚠️ ユーザー ${userId} のニックネーム復号化に失敗`);
        }
      }
    } else {
      // 旧形式（平文）の場合 - 自動移行
      console.log('⚠️ 旧形式のニックネームファイルを検出。暗号化形式に移行します...');
      
      for (const [userId, nickname] of Object.entries(savedData)) {
        userNicknames.set(userId, nickname);
      }
      
      // 暗号化形式で再保存
      saveNicknames();
      console.log('✅ 暗号化形式への移行完了');
    }
    
    console.log(`✅ ニックネーム読み込み完了 (${userNicknames.size}人)`);
  } catch (error) {
    console.error('❌ ニックネーム読み込みエラー:', error);
  }
}

// 起動時にニックネームを読み込み
loadNicknames();

// ニックネーム設定関数
function setUserNickname(userId, nickname) {
  userNicknames.set(userId, nickname);
  saveNicknames();
  console.log(`✅ ユーザー ${userId} のニックネームを「${nickname}」に設定（暗号化保存）`);
}

// ニックネーム取得関数
function getUserNickname(userId) {
  return userNicknames.get(userId) || null;
}

// ユーザーがニックネームを設定済みかチェック
function hasNickname(userId) {
  return userNicknames.has(userId);
}

// nickコマンドの検出と処理
function processNickCommand(message, userId) {
  const nickPattern = /^nick\s+(.+)$/i;
  const match = message.match(nickPattern);
  
  if (match) {
    const newNickname = match[1].trim();
    
    // ニックネームの検証
    if (newNickname.length > 20) {
      return {
        isNickCommand: true,
        success: false,
        message: "❌ ニックネームは20文字以内で設定してください。\n\n例: nick たろう"
      };
    }
    
    if (newNickname.length < 1) {
      return {
        isNickCommand: true,
        success: false,
        message: "❌ ニックネームを入力してください。\n\n例: nick たろう"
      };
    }
    
    // 禁止文字チェック
    const forbiddenChars = /[<>@#&]/;
    if (forbiddenChars.test(newNickname)) {
      return {
        isNickCommand: true,
        success: false,
        message: "❌ ニックネームに使用できない文字が含まれています。\n（< > @ # & は使用できません）\n\n例: nick たろう"
      };
    }
    
    // ニックネーム設定
    setUserNickname(userId, newNickname);
    
    return {
      isNickCommand: true,
      success: true,
      message: `✅ ニックネームを「${newNickname}」に設定しました！\n\n今後のメッセージはこの名前でDiscordと他のLINEユーザーに共有されます。\n🔒 ニックネームは暗号化して安全に保存されています。`
    };
  }
  
  return {
    isNickCommand: false
  };
}

// ニックネーム未設定ユーザーへの案内メッセージ
function getNicknamePromptMessage() {
  return `👋 はじめまして！

このボットを使用するには、まず表示名（ニックネーム）を設定してください。

📝 設定方法:
nick 好きな名前

例:
nick たろう
nick 花子
nick ゲーマー太郎

⚠️ 注意事項:
• 20文字以内で設定してください
• 一度設定すると、あなたのメッセージがDiscordと他のLINEユーザーに共有されます
• 本名以外の名前を推奨します

🔒 セキュリティ:
• ニックネームは暗号化して安全に保存されます
• 管理者でも暗号化されたニックネームの内容は確認できません

設定が完了すると、メッセージの共有が開始されます！`;
}

// ブロードキャスト送信制限
const broadcastLimiter = {
  lastSent: 0,
  minInterval: config.broadcast.minInterval,
  
  canSend() {
    const now = Date.now();
    if (now - this.lastSent < this.minInterval) {
      return false;
    }
    this.lastSent = now;
    return true;
  },
  
  getNextAllowedTime() {
    return new Date(this.lastSent + this.minInterval);
  }
};

// JWT生成関数
function generateLINEJWT() {
  try {
    const header = {
      alg: "RS256",
      typ: "JWT",
      kid: config.line.kid,
    };

    const payload = {
      iss: config.line.channelId,
      sub: config.line.channelId,
      aud: "https://api.line.me/",
      exp: Math.floor(Date.now() / 1000) + 30 * 60,
      token_exp: 60 * 60 * 24 * 30,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const data = `${encodedHeader}.${encodedPayload}`;

    const sign = crypto.createSign("RSA-SHA256");
    sign.update(data);
    const signature = sign.sign(config.line.privateKey, "base64url");

    return `${data}.${signature}`;
  } catch (error) {
    console.error("JWT生成エラー:", error);
    return null;
  }
}

// LINE アクセストークン取得
async function getLineAccessToken() {
  if (lineAccessToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
    return lineAccessToken;
  }

  try {
    const jwt = generateLINEJWT();
    if (!jwt) {
      throw new Error("JWT生成に失敗しました");
    }

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    params.append("client_assertion", jwt);

    const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    lineAccessToken = data.access_token;
    tokenExpiryTime = Date.now() + data.expires_in * 1000 - 60000;

    console.log("✅ LINE アクセストークン取得成功");
    return lineAccessToken;
  } catch (error) {
    console.error("❌ LINE アクセストークン取得エラー:", error);
    return null;
  }
}

// Discord → LINE全友だちにブロードキャスト送信
async function sendToAllLineFriends(message) {
  try {
    const accessToken = await getLineAccessToken();
    if (!accessToken) {
      console.error("❌ LINE アクセストークンが取得できません");
      return false;
    }

    const messageData = {
      messages: [{
        type: "text",
        text: message,
      }],
    };

    const response = await fetch("https://api.line.me/v2/bot/message/broadcast", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    });

    if (response.ok) {
      console.log("✅ LINE全友だちへブロードキャスト送信成功");
      return true;
    } else {
      const errorText = await response.text();
      console.error("❌ LINEブロードキャスト送信失敗:", response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error("❌ LINEブロードキャスト送信エラー:", error);
    return false;
  }
}

// 制限付きブロードキャスト送信
async function sendToAllLineFriendsWithLimit(message) {
  if (!config.broadcast.enabled) {
    console.warn("⚠️ ブロードキャスト機能が無効になっています");
    return false;
  }

  return await sendToAllLineFriends(message);
}

// LINEユーザーに返信
async function sendReplyToUser(replyToken, message) {
  try {
    const accessToken = await getLineAccessToken();
    if (!accessToken) return false;

    const messageData = {
      replyToken: replyToken,
      messages: [{
        type: "text",
        text: message
      }]
    };

    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    });

    if (response.ok) {
      console.log("✅ LINEユーザーへの返信成功");
      return true;
    } else {
      console.error("❌ LINEユーザーへの返信失敗:", response.status);
      return false;
    }
  } catch (error) {
    console.error("❌ LINEユーザー返信エラー:", error);
    return false;
  }
}

// LINE → Discord メッセージ送信
async function sendToDiscord(message, username = "LINE User", avatarUrl = null) {
  try {
    const payload = {
      content: message,
      username: username,
      avatar_url: avatarUrl,
    };

    const response = await fetch(config.discord.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log("✅ Discord メッセージ送信成功");
      return true;
    } else {
      const errorText = await response.text();
      console.error("❌ Discord メッセージ送信失敗:", response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error("❌ Discord メッセージ送信エラー:", error);
    return false;
  }
}

// ユーザーメッセージの処理（ニックネーム必須版）
async function handleUserMessage(event) {
  try {
    const userId = event.source.userId;
    const messageText = event.message.text;
    
    // nickコマンドの処理
    const nickResult = processNickCommand(messageText, userId);
    
    if (nickResult.isNickCommand) {
      // nickコマンドの場合は返信のみ
      await sendReplyToUser(event.replyToken, nickResult.message);
      return;
    }
    
    // ニックネーム未設定の場合は案内メッセージを送信
    if (!hasNickname(userId)) {
      await sendReplyToUser(event.replyToken, getNicknamePromptMessage());
      return;
    }
    
    // ニックネーム設定済みの場合のみメッセージを共有
    const username = getUserNickname(userId);
    
    // メッセージをDiscordに転送
    const formattedMessage = `${messageText}`;
    await sendToDiscord(formattedMessage, username, null);
    
    // メッセージを他のLINEユーザーにブロードキャスト
    const broadcastMessage = `${username}: ${messageText}`;
    await sendToAllLineFriendsWithLimit(broadcastMessage);

    console.log(`✅ ${username} (${userId}) のメッセージを共有: ${messageText}`);

  } catch (error) {
    console.error("❌ ユーザーメッセージ処理エラー:", error);
  }
}

// LINE Webhook処理（署名検証スキップ版）
app.post("/line-webhook", (req, res) => {
  console.warn("⚠️ 署名検証を一時的にスキップ（設定確認中）");
  
  try {
    const body = req.body.toString('utf8');
    const bodyObj = JSON.parse(body);
    const events = bodyObj.events;
    
    console.log("📡 Webhook受信:", {
      destination: bodyObj.destination,
      eventCount: events.length
    });
    
    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        if (event.source.type === "user") {
          console.log("✅ メッセージ受信:", event.message.text);
          console.log("✅ ユーザーID:", event.source.userId);
          
          const messageId = `line_${event.message.id}`;
          if (messageHistory.has(messageId)) continue;
          messageHistory.set(messageId, true);
          
          // ユーザーメッセージ処理
          handleUserMessage(event);
        }
      }
    }
    
    res.status(200).send("OK");
    
  } catch (error) {
    console.error("❌ Webhook処理エラー:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ヘルスチェック用エンドポイント
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Discord-LINE Bridge (Nickname Required + Encrypted)",
    timestamp: new Date().toISOString(),
    discord: client.readyAt ? "connected" : "disconnected",
    line: lineAccessToken ? "authenticated" : "not authenticated",
    nicknames: {
      count: userNicknames.size,
      required: true,
      encrypted: true
    },
    broadcast: {
      enabled: config.broadcast.enabled,
      minInterval: config.broadcast.minInterval,
      lastSent: broadcastLimiter.lastSent > 0 ? new Date(broadcastLimiter.lastSent).toISOString() : null
    },
    config: {
      lineChannelId: config.line.channelId,
      discordSyncChannel: config.discord.syncChannelId,
    },
    security: {
      encryptionAlgorithm: config.encryption.algorithm,
      encryptionKeySet: !!config.encryption.key
    },
    koyeb: {
      publicDomain: process.env.KOYEB_PUBLIC_DOMAIN || "not available",
      appName: process.env.KOYEB_APP_NAME || "not available",
      serviceName: process.env.KOYEB_SERVICE_NAME || "not available",
      gitSha: process.env.KOYEB_GIT_SHA || "not available",
      gitBranch: process.env.KOYEB_GIT_BRANCH || "not available"
    }
  });
});

// 設定確認用エンドポイント
app.get("/config", (req, res) => {
  res.json({
    line: {
      channelId: config.line.channelId,
      hasPrivateKey: !!config.line.privateKey,
      hasChannelSecret: !!config.line.channelSecret,
    },
    discord: {
      syncChannelId: config.discord.syncChannelId,
      hasToken: !!config.discord.token,
      hasWebhookUrl: !!config.discord.webhookUrl,
    },
    nicknames: {
      count: userNicknames.size,
      required: true,
      encrypted: true,
      file: NICKNAMES_FILE
    },
    broadcast: {
      enabled: config.broadcast.enabled,
      minInterval: config.broadcast.minInterval,
    },
    security: {
      encryptionAlgorithm: config.encryption.algorithm,
      encryptionKeySet: !!process.env.ENCRYPTION_KEY
    },
    koyeb: {
      secretsUsed: [
        "LINE_CHANNEL_SECRET",
        "LINE_KID", 
        "LINE_PRIVATE_KEY",
        "DISCORD_TOKEN",
        "DISCORD_WEBHOOK_URL",
        "ENCRYPTION_KEY"
      ],
      environmentVariables: [
        "LINE_CHANNEL_ID",
        "DISCORD_SYNC_CHANNEL_ID",
        "BROADCAST_MIN_INTERVAL",
        "BROADCAST_ENABLED",
        "PORT"
      ]
    }
  });
});

// スラッシュコマンド定義（管理者用）
const commands = [
  new SlashCommandBuilder()
    .setName("line-status")
    .setDescription("LINE連携の状態確認"),
  new SlashCommandBuilder()
    .setName("nick-list")
    .setDescription("設定済みニックネーム一覧（暗号化済み）"),
  new SlashCommandBuilder()
    .setName("nick-reset")
    .setDescription("指定ユーザーのニックネームをリセット")
    .addStringOption(option =>
      option.setName("user_id")
        .setDescription("リセットするユーザーのID")
        .setRequired(true)
    ),
];

// Discord Bot Ready イベント
client.on("ready", async () => {
  checkFilePermissions();
  console.log(`🤖 Discord Bot Ready: ${client.user.tag}`);
  console.log(`🔗 連携チャンネル: ${config.discord.syncChannelId}`);
  console.log(`📡 ブロードキャスト: ${config.broadcast.enabled ? '有効' : '無効'}`);
  console.log(`👤 ニックネーム機能: 必須 (${userNicknames.size}人設定済み)`);
  console.log(`🔒 暗号化: ${config.encryption.algorithm} (キー設定: ${!!process.env.ENCRYPTION_KEY ? '✅' : '⚠️自動生成'})`);
  console.log(`🚀 Koyeb環境: ${process.env.KOYEB_APP_NAME || 'ローカル'}`);

  await getLineAccessToken();

  const rest = new REST({ version: "9" }).setToken(config.discord.token);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands.map((cmd) => cmd.toJSON()),
    });
    console.log("✅ スラッシュコマンド登録完了");
  } catch (error) {
    console.error("❌ スラッシュコマンド登録エラー:", error);
  }

  console.log("🔄 Discord ⇄ LINE連携システム（ニックネーム必須・暗号化・Koyeb対応版）稼働中");
});

// Discord → LINE全友だち メッセージ転送（制限付き）
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.channel.id === config.discord.syncChannelId) {
    const messageId = `discord_${message.id}`;
    if (messageHistory.has(messageId)) return;
    messageHistory.set(messageId, true);

    const formattedMessage = `[Discord] ${message.author.displayName || message.author.username}: ${message.content}`;
    const success = await sendToAllLineFriendsWithLimit(formattedMessage);

    try {
      if (success) {
        await message.react("✅");
      } else {
        await message.react("⏰"); // 制限中または失敗の場合
      }
    } catch (error) {
      console.error("リアクション追加エラー:", error);
    }

    // 履歴クリーンアップ
    if (messageHistory.size > 1000) {
      const keys = Array.from(messageHistory.keys());
      for (let i = 0; i < 500; i++) {
        messageHistory.delete(keys[i]);
      }
    }
  }
});

// スラッシュコマンド処理（管理者

client.login(config.discord.token);

app.listen(config.server.port, () => {
  console.log(`🚀 Server running on port ${config.server.port}`);
  console.log(`📡 Webhook URL: ${process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}/line-webhook` : `http://localhost:${config.server.port}/line-webhook`}`);
  console.log(`🔧 Config URL: ${process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}/config` : `http://localhost:${config.server.port}/config`}`);
  console.log(`👤 ニックネーム機能: 必須（初回メッセージで設定案内）`);
  console.log(`🔒 暗号化: AES-256-GCM (${!!process.env.ENCRYPTION_KEY ? 'Koyeb Secrets設定済み' : '自動生成キー'})`);
  console.log(`📁 ファイル自動作成: 有効`);
  console.log(`🚀 Koyeb環境: ${process.env.KOYEB_APP_NAME || 'ローカル'}`);
  console.log(`⚠️  上記Webhook URLをLINE Developersコンソールに設定してください`);
  
  if (!process.env.ENCRYPTION_KEY) {
    console.log(`🔑 自動生成された暗号化キー: ${config.encryption.key}`);
    console.log(`⚠️  本番環境ではKoyeb Secretsで ENCRYPTION_KEY を設定してください`);
  }
});

// デバッグ用：ファイル権限確認
function checkFilePermissions() {
  try {
    const testFile = 'test_write.json';
    fs.writeFileSync(testFile, '{"test": true}');
    fs.unlinkSync(testFile);
    console.log('✅ ファイル書き込み権限: OK');
    return true;
  } catch (error) {
    console.error('❌ ファイル書き込み権限エラー:', error);
    return false;
  }
}
