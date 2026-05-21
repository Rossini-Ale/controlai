// server.js — Controlaí
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
require("./config/db");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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
  res.sendFile(path.join(__dirname, "public", "login.html")),
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
