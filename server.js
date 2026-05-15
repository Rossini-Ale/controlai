const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rotas
app.use("/api/auth", require("./routes/auth"));
app.use("/api/transacoes", require("./routes/transacoes"));
app.use("/api/categorias", require("./routes/categorias"));
app.use("/api/contas", require("./routes/contas"));
app.use("/api/metas", require("./routes/metas"));
app.use("/api/relatorios", require("./routes/relatorios"));
app.use("/api/cartoes", require("./routes/cartoes"));
app.use("/api/faturas", require("./routes/faturas"));

// Rota raiz → login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Controlaí rodando em: http://localhost:${PORT}`);
});
