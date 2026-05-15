const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Listar contas
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Contas WHERE usuario_id = ?", [
      req.usuarioId,
    ]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar contas." });
  }
});

// Criar conta
router.post("/", auth, async (req, res) => {
  const { nome, tipo, saldo_inicial, cor } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO Contas (usuario_id, nome, tipo, saldo_inicial, cor) VALUES (?, ?, ?, ?, ?)",
      [req.usuarioId, nome, tipo, saldo_inicial || 0, cor || "#4CAF50"],
    );
    res.status(201).json({ id: result.insertId, mensagem: "Conta criada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao criar conta." });
  }
});

// Editar conta
router.put("/:id", auth, async (req, res) => {
  const { nome, tipo, saldo_inicial, cor } = req.body;
  try {
    await db.query(
      "UPDATE Contas SET nome=?, tipo=?, saldo_inicial=?, cor=? WHERE id=? AND usuario_id=?",
      [nome, tipo, saldo_inicial, cor, req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Conta atualizada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar conta." });
  }
});

// Deletar conta
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query("DELETE FROM Contas WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Conta deletada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar conta." });
  }
});

module.exports = router;
