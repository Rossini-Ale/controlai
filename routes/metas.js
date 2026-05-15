const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Listar metas
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Metas WHERE usuario_id = ? ORDER BY prazo ASC",
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar metas." });
  }
});

// Criar meta
router.post("/", auth, async (req, res) => {
  const { nome, valor_alvo, valor_atual, prazo } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO Metas (usuario_id, nome, valor_alvo, valor_atual, prazo) VALUES (?, ?, ?, ?, ?)",
      [req.usuarioId, nome, valor_alvo, valor_atual || 0, prazo],
    );
    res.status(201).json({ id: result.insertId, mensagem: "Meta criada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao criar meta." });
  }
});

// Atualizar valor atual da meta
router.patch("/:id/progresso", auth, async (req, res) => {
  const { valor_atual } = req.body;
  try {
    await db.query(
      "UPDATE Metas SET valor_atual=? WHERE id=? AND usuario_id=?",
      [valor_atual, req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Progresso atualizado!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar progresso." });
  }
});

// Editar meta
router.put("/:id", auth, async (req, res) => {
  const { nome, valor_alvo, valor_atual, prazo, status } = req.body;
  try {
    await db.query(
      "UPDATE Metas SET nome=?, valor_alvo=?, valor_atual=?, prazo=?, status=? WHERE id=? AND usuario_id=?",
      [
        nome,
        valor_alvo,
        valor_atual,
        prazo,
        status,
        req.params.id,
        req.usuarioId,
      ],
    );
    res.json({ mensagem: "Meta atualizada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar meta." });
  }
});

// Deletar meta
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query("DELETE FROM Metas WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Meta deletada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar meta." });
  }
});

module.exports = router;
