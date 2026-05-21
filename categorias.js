const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Listar categorias (exclui deletadas)
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Categorias WHERE usuario_id = ? AND deleted_at IS NULL",
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar categorias." });
  }
});

// Criar categoria
router.post("/", auth, async (req, res) => {
  const { nome, tipo, icone, cor } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO Categorias (usuario_id, nome, tipo, icone, cor) VALUES (?, ?, ?, ?, ?)",
      [req.usuarioId, nome, tipo, icone || "fa-tag", cor || "#2196F3"],
    );
    res
      .status(201)
      .json({ id: result.insertId, mensagem: "Categoria criada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao criar categoria." });
  }
});

// Editar categoria
router.put("/:id", auth, async (req, res) => {
  const { nome, tipo, icone, cor } = req.body;
  try {
    await db.query(
      "UPDATE Categorias SET nome=?, tipo=?, icone=?, cor=? WHERE id=? AND usuario_id=? AND deleted_at IS NULL",
      [nome, tipo, icone, cor, req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Categoria atualizada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar categoria." });
  }
});

// Soft delete categoria
router.delete("/:id", auth, async (req, res) => {
  try {
    // Verifica transações vinculadas ativas
    const [transacoes] = await db.query(
      "SELECT COUNT(*) as total FROM Transacoes WHERE categoria_id = ? AND deleted_at IS NULL",
      [req.params.id],
    );
    if (transacoes[0].total > 0) {
      return res.status(400).json({
        erro: `Esta categoria possui ${transacoes[0].total} transação(ões) vinculada(s) e não pode ser excluída.`,
      });
    }
    await db.query(
      "UPDATE Categorias SET deleted_at = NOW() WHERE id=? AND usuario_id=? AND deleted_at IS NULL",
      [req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Categoria movida para a lixeira." });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar categoria." });
  }
});

// ── Lixeira de categorias ──
router.get("/lixeira", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Categorias WHERE usuario_id=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC",
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar lixeira." });
  }
});

router.patch("/:id/restaurar", auth, async (req, res) => {
  try {
    await db.query(
      "UPDATE Categorias SET deleted_at = NULL WHERE id=? AND usuario_id=?",
      [req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Categoria restaurada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao restaurar categoria." });
  }
});

router.delete("/:id/permanente", auth, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM Categorias WHERE id=? AND usuario_id=? AND deleted_at IS NOT NULL",
      [req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Categoria deletada permanentemente." });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar permanentemente." });
  }
});

module.exports = router;
