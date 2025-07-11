# ベースイメージ（Node.js 18 LTS）
FROM node:18-slim

# 作業ディレクトリ作成・移動
WORKDIR /app

# 依存ファイルをコピー
COPY package*.json ./

# 依存パッケージをインストール（--productionで本番用のみ）
RUN npm install --production

# アプリ本体をコピー
COPY . .

# 必要ならポート番号をEXPOSE（Webサーバー用途の場合のみ）
EXPOSE 3000

# 環境変数のロード（dotenv利用時はKoyeb等のPaaSで設定推奨）
# ENV NODE_ENV=production

# 起動コマンド
CMD ["node", "src/index.js"]
