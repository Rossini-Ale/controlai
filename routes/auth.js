const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const auth = require("../middleware/auth");

const CATEGORIAS_PADRAO = [
  {
    nome: "Alimentação",
    tipo: "despesa",
    icone: "fa-utensils",
    cor: "#ef4444",
  },
  { nome: "Transporte", tipo: "despesa", icone: "fa-car", cor: "#f97316" },
  { nome: "Saúde", tipo: "despesa", icone: "fa-heart-pulse", cor: "#ec4899" },
  {
    nome: "Educação",
    tipo: "despesa",
    icone: "fa-graduation-cap",
    cor: "#8b5cf6",
  },
  { nome: "Lazer", tipo: "despesa", icone: "fa-gamepad", cor: "#06b6d4" },
  { nome: "Vestuário", tipo: "despesa", icone: "fa-shirt", cor: "#6366f1" },
  { nome: "Moradia", tipo: "despesa", icone: "fa-house", cor: "#84cc16" },
  { nome: "Assinaturas", tipo: "despesa", icone: "fa-tv", cor: "#14b8a6" },
  { nome: "Eletrônicos", tipo: "despesa", icone: "fa-laptop", cor: "#3b82f6" },
  { nome: "Pet", tipo: "despesa", icone: "fa-dog", cor: "#a78bfa" },
  { nome: "Viagem", tipo: "despesa", icone: "fa-plane", cor: "#f59e0b" },
  {
    nome: "Mercado",
    tipo: "despesa",
    icone: "fa-cart-shopping",
    cor: "#10b981",
  },
  { nome: "Restaurante", tipo: "despesa", icone: "fa-burger", cor: "#ef4444" },
  {
    nome: "Combustível",
    tipo: "despesa",
    icone: "fa-gas-pump",
    cor: "#f97316",
  },
  { nome: "Farmácia", tipo: "despesa", icone: "fa-pills", cor: "#ec4899" },
  { nome: "Outros", tipo: "despesa", icone: "fa-tag", cor: "#6b7280" },
  { nome: "Salário", tipo: "receita", icone: "fa-money-bill", cor: "#10b981" },
  { nome: "Freelance", tipo: "receita", icone: "fa-briefcase", cor: "#06b6d4" },
  {
    nome: "Investimentos",
    tipo: "receita",
    icone: "fa-piggy-bank",
    cor: "#8b5cf6",
  },
  {
    nome: "Transferência",
    tipo: "receita",
    icone: "fa-right-left",
    cor: "#3b82f6",
  },
  { nome: "Outros", tipo: "receita", icone: "fa-tag", cor: "#6b7280" },
];

// Cadastro
router.post("/cadastro", async (req, res) => {
  const { nome, email, username, senha } = req.body;
  try {
    const hash = await bcrypt.hash(senha, 10);
    const [result] = await db.query(
      "INSERT INTO Usuarios (nome, email, username, senha) VALUES (?, ?, ?, ?)",
      [nome, email, username, hash],
    );
    const usuarioId = result.insertId;

    for (const cat of CATEGORIAS_PADRAO) {
      await db.query(
        "INSERT INTO Categorias (usuario_id, nome, tipo, icone, cor) VALUES (?, ?, ?, ?, ?)",
        [usuarioId, cat.nome, cat.tipo, cat.icone, cat.cor],
      );
    }

    await db.query(
      "INSERT INTO Contas (usuario_id, nome, tipo, saldo_inicial, cor) VALUES (?, ?, ?, ?, ?)",
      [usuarioId, "Carteira", "carteira", 0, "#10b981"],
    );

    res.status(201).json({ mensagem: "Usuário criado com sucesso!" });
  } catch (err) {
    res.status(400).json({ erro: "Email ou username já cadastrado." });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { username, senha } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM Usuarios WHERE username = ?", [
      username,
    ]);
    if (rows.length === 0) {
      return res.status(401).json({ erro: "Usuário não encontrado." });
    }
    const usuario = rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Senha incorreta." });
    }
    const token = jwt.sign(
      { id: usuario.id, username: usuario.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({ token, nome: usuario.nome, username: usuario.username });
  } catch (err) {
    res.status(500).json({ erro: "Erro interno do servidor." });
  }
});

// Buscar perfil
router.get("/perfil", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nome, email, username, telegram_chat_id, created_at FROM Usuarios WHERE id = ?",
      [req.usuarioId],
    );
    if (rows.length === 0)
      return res.status(404).json({ erro: "Usuário não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar perfil." });
  }
});

// Atualizar perfil
router.put("/perfil", auth, async (req, res) => {
  const { nome, email } = req.body;
  try {
    await db.query("UPDATE Usuarios SET nome=?, email=? WHERE id=?", [
      nome,
      email,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Perfil atualizado!" });
  } catch (err) {
    res.status(500).json({ erro: "Email já cadastrado." });
  }
});

// Alterar senha
router.put("/perfil/senha", auth, async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM Usuarios WHERE id=?", [
      req.usuarioId,
    ]);
    const usuario = rows[0];
    const senhaValida = await bcrypt.compare(senha_atual, usuario.senha);
    if (!senhaValida)
      return res.status(401).json({ erro: "Senha atual incorreta." });
    const hash = await bcrypt.hash(nova_senha, 10);
    await db.query("UPDATE Usuarios SET senha=? WHERE id=?", [
      hash,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Senha alterada com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao alterar senha." });
  }
});

module.exports = router;
