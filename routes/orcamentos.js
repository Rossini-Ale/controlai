// routes/orcamentos.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// ── GET /?mes=&ano= ──
router.get("/", auth, async (req, res) => {
  const { mes, ano } = req.query;
  if (!mes || !ano) return res.status(400).json({ erro: "Informe mes e ano." });
  try {
    const [rows] = await db.query(
      `SELECT
         o.id, o.usuario_id, o.categoria_id, o.mes, o.ano, o.limite,
         o.alerta_80_enviado, o.alerta_100_enviado,
         c.nome AS categoria_nome, c.cor AS categoria_cor, c.icone AS categoria_icone,
         COALESCE((
           SELECT SUM(t.valor) FROM Transacoes t
           WHERE t.usuario_id = o.usuario_id AND t.tipo = 'despesa'
             AND IFNULL(t.is_transferencia, 0) = 0
             AND (o.categoria_id IS NULL OR t.categoria_id = o.categoria_id)
             AND MONTH(t.data) = o.mes AND YEAR(t.data) = o.ano
         ), 0) AS gasto_atual
       FROM Orcamentos o
       LEFT JOIN Categorias c ON o.categoria_id = c.id
       WHERE o.usuario_id = ? AND o.mes = ? AND o.ano = ?
       ORDER BY (o.categoria_id IS NULL) DESC, c.nome ASC`,
      [req.usuarioId, mes, ano],
    );
    res.json(rows);
  } catch (err) {
    console.error("[Orcamentos GET]", err.message);
    res
      .status(500)
      .json({ erro: "Erro ao buscar orçamentos.", detalhe: err.message });
  }
});

// ── GET /resumo?mes=&ano= ──
router.get("/resumo", auth, async (req, res) => {
  const { mes, ano } = req.query;
  if (!mes || !ano) return res.status(400).json({ erro: "Informe mes e ano." });
  try {
    const [geralRows] = await db.query(
      `SELECT o.limite,
              COALESCE((
                SELECT SUM(t.valor) FROM Transacoes t
                WHERE t.usuario_id = ? AND t.tipo = 'despesa'
                  AND IFNULL(t.is_transferencia, 0) = 0
                  AND MONTH(t.data) = ? AND YEAR(t.data) = ?
              ), 0) AS gasto_total
       FROM Orcamentos o
       WHERE o.usuario_id = ? AND o.categoria_id IS NULL AND o.mes = ? AND o.ano = ?
       LIMIT 1`,
      [req.usuarioId, mes, ano, req.usuarioId, mes, ano],
    );
    const [categorias] = await db.query(
      `SELECT o.id, o.categoria_id, o.limite,
              c.nome AS categoria_nome, c.cor AS categoria_cor, c.icone AS categoria_icone,
              COALESCE((
                SELECT SUM(t.valor) FROM Transacoes t
                WHERE t.usuario_id = o.usuario_id AND t.tipo = 'despesa'
                  AND IFNULL(t.is_transferencia, 0) = 0
                  AND t.categoria_id = o.categoria_id
                  AND MONTH(t.data) = o.mes AND YEAR(t.data) = o.ano
              ), 0) AS gasto_atual
       FROM Orcamentos o
       JOIN Categorias c ON o.categoria_id = c.id
       WHERE o.usuario_id = ? AND o.mes = ? AND o.ano = ?
       ORDER BY c.nome ASC`,
      [req.usuarioId, mes, ano],
    );
    res.json({ geral: geralRows[0] || null, categorias: categorias || [] });
  } catch (err) {
    console.error("[Orcamentos RESUMO]", err.message);
    res
      .status(500)
      .json({ erro: "Erro ao buscar resumo.", detalhe: err.message });
  }
});

// ── POST / — Upsert ──
router.post("/", auth, async (req, res) => {
  const { categoria_id, mes, ano, limite } = req.body;
  if (!mes || !ano || !limite)
    return res.status(400).json({ erro: "Informe mes, ano e limite." });
  const limiteFloat = parseFloat(limite);
  if (isNaN(limiteFloat) || limiteFloat <= 0)
    return res.status(400).json({ erro: "Limite inválido." });
  try {
    await db.query(
      `INSERT INTO Orcamentos (usuario_id, categoria_id, mes, ano, limite)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE limite = VALUES(limite), alerta_80_enviado = 0, alerta_100_enviado = 0`,
      [req.usuarioId, categoria_id || null, mes, ano, limiteFloat],
    );
    res.status(201).json({ mensagem: "Orçamento salvo!" });
  } catch (err) {
    console.error("[Orcamentos POST]", err.message);
    res
      .status(500)
      .json({ erro: "Erro ao salvar orçamento.", detalhe: err.message });
  }
});

// ── DELETE /:id ──
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
