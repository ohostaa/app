const path = require("path");
const fastify = require("fastify")({
  logger: false,
});

// 静的ファイル設定
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

fastify.register(require("@fastify/formbody"));

// メインのHTMLテンプレート関数
function getMainHTML(content, title = "Juju-navi") {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 0;
        }
        
        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            color: #667eea;
            text-decoration: none;
        }
        
        .nav-links {
            display: flex;
            list-style: none;
            gap: 2rem;
        }
        
        .nav-links a {
            text-decoration: none;
            color: #333;
            font-weight: 500;
            transition: color 0.3s ease;
        }
        
        .nav-links a:hover {
            color: #667eea;
        }
        
        main {
            padding: 2rem 0;
        }
        
        .hero {
            text-align: center;
            padding: 4rem 0;
            color: white;
        }
        
        .hero h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .hero p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        
        .card {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            margin: 2rem 0;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        .btn {
            display: inline-block;
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 25px;
            text-decoration: none;
            font-weight: 500;
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        
        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.3s ease;
        }
        
        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin: 2rem 0;
        }
        
        .service-card {
            background: white;
            border-radius: 10px;
            padding: 1.5rem;
            text-align: center;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        
        .service-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        
        footer {
            background: rgba(0, 0, 0, 0.8);
            color: white;
            text-align: center;
            padding: 2rem 0;
            margin-top: 4rem;
        }
        
        @media (max-width: 768px) {
            .nav-links {
                display: none;
            }
            
            .hero h1 {
                font-size: 2rem;
            }
            
            .services-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <header>
        <nav class="container">
            <a href="/" class="logo">Juju-navi</a>
            <ul class="nav-links">
                <li><a href="/">ホーム</a></li>
                <li><a href="/about">会社概要</a></li>
                <li><a href="/services">サービス</a></li>
                <li><a href="/contact">お問い合わせ</a></li>
            </ul>
        </nav>
    </header>
    
    <main>
        ${content}
    </main>
    
    <footer>
        <div class="container">
            <p>&copy; 2025 Juju-navi. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>
  `;
}

// ホームページ
fastify.get("/", function (request, reply) {
  const content = `
    <div class="hero">
        <div class="container">
            <h1>Juju-naviへようこそ</h1>
            <p>革新的なナビゲーションサービスで、あなたの旅をもっと便利に</p>
            <a href="/services" class="btn">サービスを見る</a>
        </div>
    </div>
    
    <div class="container">
        <div class="card">
            <h2>私たちについて</h2>
            <p>Juju-naviは最新技術を活用した革新的なナビゲーションサービスを提供しています。ユーザーの利便性を第一に考え、直感的で使いやすいインターフェースを実現しました。</p>
        </div>
        
        <div class="services-grid">
            <div class="service-card">
                <div class="service-icon">🗺️</div>
                <h3>スマートナビゲーション</h3>
                <p>AI技術を活用した最適ルート案内</p>
            </div>
            <div class="service-card">
                <div class="service-icon">📱</div>
                <h3>モバイル対応</h3>
                <p>どこでもアクセス可能なレスポンシブデザイン</p>
            </div>
            <div class="service-card">
                <div class="service-icon">⚡</div>
                <h3>高速処理</h3>
                <p>リアルタイムでの情報更新と高速レスポンス</p>
            </div>
        </div>
    </div>
  `;
  
  reply.type('text/html').send(getMainHTML(content, "Juju-navi - ホーム"));
});

// 会社概要ページ
fastify.get("/about", function (request, reply) {
  const content = `
    <div class="container">
        <div class="card">
            <h1>会社概要</h1>
            <p>Juju-naviは2025年に設立された革新的なナビゲーションサービス会社です。</p>
            
            <h2>ミッション</h2>
            <p>私たちは、最新技術を活用してユーザーの移動体験を向上させ、より便利で効率的な社会の実現を目指しています。</p>
            
            <h2>ビジョン</h2>
            <p>すべての人が迷うことなく、安全で快適な移動ができる世界を創造します。</p>
            
            <h2>価値観</h2>
            <ul>
                <li>ユーザーファースト</li>
                <li>技術革新</li>
                <li>持続可能性</li>
                <li>チームワーク</li>
            </ul>
        </div>
    </div>
  `;
  
  reply.type('text/html').send(getMainHTML(content, "会社概要 - Juju-navi"));
});

// サービスページ
fastify.get("/services", function (request, reply) {
  const content = `
    <div class="container">
        <div class="card">
            <h1>サービス一覧</h1>
            <p>Juju-naviが提供する革新的なサービスをご紹介します。</p>
        </div>
        
        <div class="services-grid">
            <div class="service-card">
                <div class="service-icon">🚗</div>
                <h3>カーナビゲーション</h3>
                <p>リアルタイム交通情報を活用した最適ルート案内。渋滞回避や燃費効率を考慮したルート提案を行います。</p>
            </div>
            <div class="service-card">
                <div class="service-icon">🚶</div>
                <h3>歩行者ナビ</h3>
                <p>歩行者専用の詳細なルート案内。階段やエレベーターの位置、バリアフリー情報も含めた案内を提供します。</p>
            </div>
            <div class="service-card">
                <div class="service-icon">🚌</div>
                <h3>公共交通機関</h3>
                <p>電車、バス、地下鉄の乗り換え案内。遅延情報や運行状況をリアルタイムで更新します。</p>
            </div>
            <div class="service-card">
                <div class="service-icon">🏢</div>
                <h3>屋内ナビゲーション</h3>
                <p>大型商業施設や空港、駅構内での詳細な案内サービス。目的地まで迷わずご案内します。</p>
            </div>
            <div class="service-card">
                <div class="service-icon">🌍</div>
                <h3>海外対応</h3>
                <p>世界各国の地図データと多言語対応。海外旅行でも安心してご利用いただけます。</p>
            </div>
            <div class="service-card">
                <div class="service-icon">🔧</div>
                <h3>API提供</h3>
                <p>開発者向けのナビゲーションAPI。あなたのアプリケーションに簡単に組み込めます。</p>
            </div>
        </div>
    </div>
  `;
  
  reply.type('text/html').send(getMainHTML(content, "サービス - Juju-navi"));
});

// お問い合わせページ
fastify.get("/contact", function (request, reply) {
  const content = `
    <div class="container">
        <div class="card">
            <h1>お問い合わせ</h1>
            <p>ご質問やご要望がございましたら、お気軽にお問い合わせください。</p>
            
            <form method="POST" action="/contact">
                <div class="form-group">
                    <label for="name">お名前</label>
                    <input type="text" id="name" name="name" required>
                </div>
                
                <div class="form-group">
                    <label for="email">メールアドレス</label>
                    <input type="email" id="email" name="email" required>
                </div>
                
                <div class="form-group">
                    <label for="subject">件名</label>
                    <input type="text" id="subject" name="subject" required>
                </div>
                
                <div class="form-group">
                    <label for="message">メッセージ</label>
                    <textarea id="message" name="message" rows="5" required></textarea>
                </div>
                
                <button type="submit" class="btn">送信する</button>
            </form>
        </div>
        
        <div class="card">
            <h2>その他のお問い合わせ方法</h2>
            <p><strong>電話:</strong> 03-1234-5678</p>
            <p><strong>メール:</strong> info@juju-navi.com</p>
            <p><strong>営業時間:</strong> 平日 9:00-18:00</p>
        </div>
    </div>
  `;
  
  reply.type('text/html').send(getMainHTML(content, "お問い合わせ - Juju-navi"));
});

// お問い合わせフォーム送信処理
fastify.post("/contact", function (request, reply) {
  const { name, email, subject, message } = request.body;
  
  // ここで実際のメール送信処理を行う（今回は省略）
  console.log("お問い合わせを受信:", { name, email, subject, message });
  
  const content = `
    <div class="container">
        <div class="card">
            <h1>お問い合わせありがとうございます</h1>
            <p>お問い合わせを受け付けました。2営業日以内にご返信いたします。</p>
            
            <h2>送信内容</h2>
            <p><strong>お名前:</strong> ${name}</p>
            <p><strong>メールアドレス:</strong> ${email}</p>
            <p><strong>件名:</strong> ${subject}</p>
            <p><strong>メッセージ:</strong></p>
            <p>${message}</p>
            
            <a href="/" class="btn">ホームに戻る</a>
        </div>
    </div>
  `;
  
  reply.type('text/html').send(getMainHTML(content, "送信完了 - Juju-navi"));
});

// サーバー起動
fastify.listen(
  { port: process.env.PORT || 3000, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Juju-naviサーバーが起動しました: ${address}`);
  }
);
