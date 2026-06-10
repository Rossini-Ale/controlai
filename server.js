// server.js — Controlaí
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
require("./config/db");

const app = express();
// CSP desativado: app usa scripts inline extensivamente (refatorar para nonces é trabalho futuro)
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Rate limiting ──
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { erro: "Muitas tentativas. Aguarde 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const limiterCadastro = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { erro: "Muitos cadastros deste IP. Aguarde 1 hora." },
  standardHeaders: true,
  legacyHeaders: false,
});

const limiterEsqueci = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { erro: "Muitas solicitações. Aguarde 1 hora." },
  standardHeaders: true,
  legacyHeaders: false,
});

const limiterApi = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { erro: "Muitas requisições. Tente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Rate limiters específicos (antes das rotas) ──
app.post("/api/auth/login", limiterAuth);
app.post("/api/auth/cadastro", limiterCadastro);
app.post("/api/auth/esqueci-senha", limiterEsqueci);
app.use("/api", limiterApi);

// ── Rotas ──
app.use("/api/auth", require("./routes/auth"));
app.use("/api/transacoes", require("./routes/transacoes"));
app.use("/api/categorias", require("./routes/categorias"));
app.use("/api/contas", require("./routes/contas"));
app.use("/api/metas", require("./routes/metas"));
app.use("/api/relatorios", require("./routes/relatorios"));
app.use("/api/cartoes", require("./routes/cartoes"));
app.use("/api/faturas", require("./routes/faturas"));
app.use("/api/recorrentes", require("./routes/recorrentes"));
app.use("/api/transferencias", require("./routes/transferencias"));
app.use("/api/orcamentos", require("./routes/orcamentos"));
app.use("/api/importacao", require("./routes/importacao"));
app.use("/api/pagamentos", require("./routes/pagamentos").router); // GET /status não usa Stripe; POST /criar-sessao e /portal só falham se chamados sem STRIPE_SECRET_KEY

// ── Telegram webhook ──
const bot = require("./routes/telegram");
bot.setWebHook(
  `https://controlai.up.railway.app/bot${process.env.TELEGRAM_TOKEN}`,
);
app.post(`/bot${process.env.TELEGRAM_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ── Rota raiz ──
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);

// ── Inicialização: migrations → servidor → cron ──
const { rodarMigrations } = require("./migration");
const { rodarTudo } = require("./routes/recorrentes-engine");
const PORT = process.env.PORT || 3000;

rodarMigrations()
  .catch((err) => console.error("❌ Migrations com erro:", err.message))
  .finally(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Controlaí rodando em: http://localhost:${PORT}`);
    });
    setTimeout(() => {
      rodarTudo();
      setInterval(rodarTudo, 60 * 60 * 1000);
    }, 5000);
  });
