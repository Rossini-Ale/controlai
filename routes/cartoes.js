const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Listar cartões — fatura_atual só do mês corrente
router.get("/", auth, async (req, res) => {
  try {
    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();

    const [rows] = await db.query(
      `SELECT c.*,
        COALESCE((
          SELECT SUM(t.valor)
          FROM Transacoes t
          INNER JOIN FaturasCartao f ON t.fatura_id = f.id
          WHERE t.cartao_id = c.id
            AND f.mes = ?
            AND f.ano = ?
        ), 0) as fatura_atual
       FROM Cartoes c
       WHERE c.usuario_id = ?`,
      [mes, ano, req.usuarioId],
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

// Deletar cartão — apaga transações e faturas vinculadas antes
router.delete("/:id", auth, async (req, res) => {
  const cartaoId = req.params.id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [faturas] = await conn.query(
      "SELECT id FROM FaturasCartao WHERE cartao_id = ? AND usuario_id = ?",
      [cartaoId, req.usuarioId],
    );
    const faturaIds = faturas.map((f) => f.id);

    if (faturaIds.length > 0) {
      await conn.query(
        `DELETE FROM Transacoes WHERE fatura_id IN (${faturaIds.map(() => "?").join(",")})`,
        faturaIds,
      );
    }

    await conn.query(
      "DELETE FROM Transacoes WHERE cartao_id = ? AND usuario_id = ?",
      [cartaoId, req.usuarioId],
    );
    await conn.query(
      "DELETE FROM FaturasCartao WHERE cartao_id = ? AND usuario_id = ?",
      [cartaoId, req.usuarioId],
    );
    await conn.query("DELETE FROM Cartoes WHERE id = ? AND usuario_id = ?", [
      cartaoId,
      req.usuarioId,
    ]);

    await conn.commit();
    res.json({ mensagem: "Cartão deletado!" });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ erro: "Erro ao deletar cartão." });
  } finally {
    conn.release();
  }
});

module.exports = router;
