const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Listar cartões
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*,
        COALESCE((
          SELECT SUM(t.valor) FROM Transacoes t
          INNER JOIN FaturasCartao f ON t.fatura_id = f.id
          WHERE t.cartao_id = c.id AND f.status = 'aberta'
        ), 0) as fatura_atual
       FROM Cartoes c WHERE c.usuario_id = ?`,
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar cartões." });
  }
});

// Criar cartão
router.post("/", auth, async (req, res) => {
  const { nome, limite, dia_fechamento, dia_vencimento, cor } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO Cartoes (usuario_id, nome, limite, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?, ?, ?)",
      [
        req.usuarioId,
        nome,
        limite || 0,
        dia_fechamento || 1,
        dia_vencimento || 10,
        cor || "#6366f1",
      ],
    );
    res.status(201).json({ id: result.insertId, mensagem: "Cartão criado!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao criar cartão." });
  }
});

// Editar cartão
router.put("/:id", auth, async (req, res) => {
  const { nome, limite, dia_fechamento, dia_vencimento, cor } = req.body;
  try {
    await db.query(
      "UPDATE Cartoes SET nome=?, limite=?, dia_fechamento=?, dia_vencimento=?, cor=? WHERE id=? AND usuario_id=?",
      [
        nome,
        limite,
        dia_fechamento,
        dia_vencimento,
        cor,
        req.params.id,
        req.usuarioId,
      ],
    );
    res.json({ mensagem: "Cartão atualizado!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar cartão." });
  }
});

// Deletar cartão
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query("DELETE FROM Cartoes WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Cartão deletado!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar cartão." });
  }
});

module.exports = router;
