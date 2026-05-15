const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Resumo do mês (receitas, despesas, saldo)
router.get("/resumo", auth, async (req, res) => {
  const { mes, ano } = req.query;
  try {
    const [rows] = await db.query(
      `SELECT 
        SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) as total_receitas,
        SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as total_despesas,
        SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END) as saldo
       FROM Transacoes
       WHERE usuario_id = ? AND MONTH(data) = ? AND YEAR(data) = ?`,
      [req.usuarioId, mes, ano],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar resumo." });
  }
});

// Gastos por categoria no mês
router.get("/por-categoria", auth, async (req, res) => {
  const { mes, ano, tipo } = req.query;
  try {
    const [rows] = await db.query(
      `SELECT c.nome, c.cor, c.icone,
              SUM(t.valor) as total,
              COUNT(t.id) as quantidade
       FROM Transacoes t
       LEFT JOIN Categorias c ON t.categoria_id = c.id
       WHERE t.usuario_id = ? AND MONTH(t.data) = ? AND YEAR(t.data) = ?
       AND t.tipo = ?
       GROUP BY t.categoria_id, c.nome, c.cor, c.icone
       ORDER BY total DESC`,
      [req.usuarioId, mes, ano, tipo || "despesa"],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar gastos por categoria." });
  }
});

// Evolução mensal (últimos 6 meses)
router.get("/evolucao", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        MONTH(data) as mes,
        YEAR(data) as ano,
        SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) as receitas,
        SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as despesas
       FROM Transacoes
       WHERE usuario_id = ?
       AND data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY YEAR(data), MONTH(data)
       ORDER BY ano ASC, mes ASC`,
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar evolução." });
  }
});

// Saldo por conta
router.get("/saldo-contas", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ct.nome, ct.cor, ct.tipo,
              ct.saldo_inicial,
              ct.saldo_inicial + 
              SUM(CASE WHEN t.tipo = 'receita' THEN t.valor 
                       WHEN t.tipo = 'despesa' THEN -t.valor 
                       ELSE 0 END) as saldo_atual
       FROM Contas ct
       LEFT JOIN Transacoes t ON ct.id = t.conta_id
       WHERE ct.usuario_id = ?
       GROUP BY ct.id, ct.nome, ct.cor, ct.tipo, ct.saldo_inicial`,
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar saldo das contas." });
  }
});

module.exports = router;
