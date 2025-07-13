# ベースイメージ
FROM openjdk:21-jdk-slim

# 作業ディレクトリ作成
WORKDIR /app

# Minecraftサーバーのダウンロード
RUN apt-get update && apt-get install -y wget \
  && wget -O server.jar https://piston-data.mojang.com/v1/objects/05e4b48fbc01f0385adb74bcff9751d34552486c/server.jar

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
