const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Listar categorias
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Categorias WHERE usuario_id = ?",
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
      "UPDATE Categorias SET nome=?, tipo=?, icone=?, cor=? WHERE id=? AND usuario_id=?",
      [nome, tipo, icone, cor, req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Categoria atualizada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar categoria." });
  }
});

// Deletar categoria
// Deletar categoria
router.delete("/:id", auth, async (req, res) => {
  try {
    // Verifica se tem transações vinculadas
    const [transacoes] = await db.query(
      "SELECT COUNT(*) as total FROM Transacoes WHERE categoria_id = ?",
      [req.params.id],
    );

    if (transacoes[0].total > 0) {
      return res.status(400).json({
        erro: `Esta categoria possui ${transacoes[0].total} transação(ões) vinculada(s) e não pode ser excluída.`,
      });
    }

    await db.query("DELETE FROM Categorias WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Categoria deletada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar categoria." });
  }
});
module.exports = router;
