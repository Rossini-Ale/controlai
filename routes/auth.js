const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

// Cadastro
router.post("/cadastro", async (req, res) => {
  const { nome, email, username, senha } = req.body;
  try {
    const hash = await bcrypt.hash(senha, 10);
    await db.query(
      "INSERT INTO Usuarios (nome, email, username, senha) VALUES (?, ?, ?, ?)",
      [nome, email, username, hash],
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

module.exports = router;
