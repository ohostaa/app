# ベースイメージ
FROM openjdk:17-jdk-slim

# 作業ディレクトリ作成
WORKDIR /app

# Minecraftサーバーのダウンロード
RUN apt-get update && apt-get install -y wget \
  && wget -O server.jar https://launcher.mojang.com/v1/objects/fe3aa5a9c3f1b6e5b7b2b5a8c5c6b7b5d9b6e5b7/server.jar

# EULA同意
RUN echo "eula=true" > eula.txt

# Node.jsインストール
RUN apt-get install -y nodejs npm

# ソースコード追加
COPY package.json .
COPY main.mjs .

# npm install（必要なら）
RUN npm install

# ポート開放
EXPOSE 25565

# サーバー起動
CMD ["node", "main.mjs"]
