// routes/orcamentos.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// ── GET /?mes=&ano= — Listar orçamentos do mês com gasto atual ──
router.get("/", auth, async (req, res) => {
  const { mes, ano } = req.query;
  if (!mes || !ano) return res.status(400).json({ erro: "Informe mes e ano." });

  try {
    const [rows] = await db.query(
      `SELECT
         o.*,
         c.nome        AS categoria_nome,
         c.cor         AS categoria_cor,
         c.icone       AS categoria_icone,
         COALESCE((
           SELECT SUM(t.valor)
           FROM Transacoes t
           WHERE t.usuario_id = o.usuario_id
             AND t.tipo = 'despesa'
             AND t.is_transferencia = 0
             AND (o.categoria_id IS NULL OR t.categoria_id = o.categoria_id)
             AND MONTH(t.data) = o.mes
             AND YEAR(t.data)  = o.ano
         ), 0) AS gasto_atual
       FROM Orcamentos o
       LEFT JOIN Categorias c ON o.categoria_id = c.id
       WHERE o.usuario_id = ? AND o.mes = ? AND o.ano = ?
       ORDER BY o.categoria_id IS NULL DESC, c.nome ASC`,
      [req.usuarioId, mes, ano],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar orçamentos." });
  }
});

// ── GET /resumo?mes=&ano= — Resumo geral do orçamento do mês ──
router.get("/resumo", auth, async (req, res) => {
  const { mes, ano } = req.query;
  if (!mes || !ano) return res.status(400).json({ erro: "Informe mes e ano." });

  try {
    // Orçamento geral
    const [geral] = await db.query(
      `SELECT o.limite,
              COALESCE((
                SELECT SUM(t.valor) FROM Transacoes t
                WHERE t.usuario_id = ? AND t.tipo = 'despesa'
                  AND t.is_transferencia = 0
                  AND MONTH(t.data) = ? AND YEAR(t.data) = ?
              ), 0) AS gasto_total
       FROM Orcamentos o
       WHERE o.usuario_id = ? AND o.categoria_id IS NULL AND o.mes = ? AND o.ano = ?`,
      [req.usuarioId, mes, ano, req.usuarioId, mes, ano],
    );

    // Por categoria
    const [categorias] = await db.query(
      `SELECT o.*, c.nome AS categoria_nome, c.cor AS categoria_cor, c.icone AS categoria_icone,
              COALESCE((
                SELECT SUM(t.valor) FROM Transacoes t
                WHERE t.usuario_id = o.usuario_id AND t.tipo = 'despesa'
                  AND t.is_transferencia = 0
                  AND t.categoria_id = o.categoria_id
                  AND MONTH(t.data) = o.mes AND YEAR(t.data) = o.ano
              ), 0) AS gasto_atual
       FROM Orcamentos o
       JOIN Categorias c ON o.categoria_id = c.id
       WHERE o.usuario_id = ? AND o.mes = ? AND o.ano = ?
       ORDER BY c.nome ASC`,
      [req.usuarioId, mes, ano],
    );

    res.json({
      geral: geral[0] || null,
      categorias,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar resumo de orçamento." });
  }
});

// ── POST / — Criar ou atualizar orçamento (upsert) ──
router.post("/", auth, async (req, res) => {
  const { categoria_id, mes, ano, limite } = req.body;

  if (!mes || !ano || !limite) {
    return res.status(400).json({ erro: "Informe mes, ano e limite." });
  }

  const limiteFloat = parseFloat(limite);
  if (isNaN(limiteFloat) || limiteFloat <= 0) {
    return res.status(400).json({ erro: "Limite deve ser maior que zero." });
  }

  try {
    await db.query(
      `INSERT INTO Orcamentos (usuario_id, categoria_id, mes, ano, limite)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         limite = VALUES(limite),
         alerta_80_enviado  = 0,
         alerta_100_enviado = 0`,
      [req.usuarioId, categoria_id || null, mes, ano, limiteFloat],
    );
    res.status(201).json({ mensagem: "Orçamento salvo!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao salvar orçamento." });
  }
});

// ── DELETE /:id — Remover orçamento ──
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query("DELETE FROM Orcamentos WHERE id = ? AND usuario_id = ?", [
      req.params.id,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Orçamento removido!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao remover orçamento." });
  }
});

module.exports = router;
