const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const db = require("../config/db");
const { calcularProximaData, toDateStr } = require("./recorrentes-engine");

router.get("/fluxo", auth, async (req, res) => {
  const dias = Math.min(parseInt(req.query.dias) || 30, 90);
  try {
    // Saldo atual de todas as contas
    const [[saldoRow]] = await db.query(
      `SELECT SUM(c.saldo_inicial +
         COALESCE((
           SELECT SUM(CASE WHEN t.tipo='receita' THEN t.valor ELSE -t.valor END)
           FROM Transacoes t WHERE t.conta_id = c.id AND t.deleted_at IS NULL
         ), 0)
       ) AS saldo_total
       FROM Contas c WHERE c.usuario_id = ?`,
      [req.usuarioId],
    );
    const saldoInicial = parseFloat(saldoRow?.saldo_total) || 0;

    // Recorrentes ativas
    const [recorrentes] = await db.query(
      `SELECT * FROM TransacoesRecorrentes
       WHERE usuario_id = ? AND ativa = 1
         AND (data_fim IS NULL OR data_fim >= CURDATE())`,
      [req.usuarioId],
    );

    // Transações já lançadas nos próximos dias (agendadas)
    const hoje = new Date();
    const fimDate = new Date(hoje.getTime() + dias * 86400000);
    const fimStr = toDateStr(fimDate);
    const hojeStr = toDateStr(hoje);

    const [lancadas] = await db.query(
      `SELECT data, tipo, valor, descricao FROM Transacoes
       WHERE usuario_id = ? AND deleted_at IS NULL
         AND data > ? AND data <= ?`,
      [req.usuarioId, hojeStr, fimStr],
    );

    // Monta mapa dia → eventos
    const eventos = {}; // { "2026-05-25": [{ descricao, valor, tipo }] }

    lancadas.forEach((t) => {
      const d = t.data.toISOString?.().split("T")[0] || t.data;
      if (!eventos[d]) eventos[d] = [];
      eventos[d].push({
        descricao: t.descricao,
        valor: parseFloat(t.valor),
        tipo: t.tipo,
      });
    });

    // Projeta recorrentes
    for (const rec of recorrentes) {
      let proxima = new Date(rec.proxima_geracao + "T00:00:00");
      let safeGuard = 0;
      while (toDateStr(proxima) <= fimStr && safeGuard < 200) {
        safeGuard++;
        const dStr = toDateStr(proxima);
        if (dStr > hojeStr) {
          if (!eventos[dStr]) eventos[dStr] = [];
          eventos[dStr].push({
            descricao: rec.descricao,
            valor: parseFloat(rec.valor),
            tipo: rec.tipo,
            recorrente: true,
          });
        }
        proxima = calcularProximaData(
          proxima,
          rec.frequencia,
          rec.dia_vencimento,
        );
      }
    }

    // Gera linha do tempo dia a dia
    const timeline = [];
    let saldoAcumulado = saldoInicial;

    for (let i = 1; i <= dias; i++) {
      const d = new Date(hoje.getTime() + i * 86400000);
      const dStr = toDateStr(d);
      const evts = eventos[dStr] || [];

      let entradas = 0,
        saidas = 0;
      evts.forEach((e) => {
        if (e.tipo === "receita") entradas += e.valor;
        else saidas += e.valor;
      });

      saldoAcumulado += entradas - saidas;
      timeline.push({
        data: dStr,
        entradas,
        saidas,
        saldo: saldoAcumulado,
        eventos: evts,
      });
    }

    res.json({ saldo_inicial: saldoInicial, timeline });
  } catch (err) {
    console.error("[Fluxo]", err.message);
    res.status(500).json({ erro: "Erro ao calcular fluxo de caixa." });
  }
});

// ── Resumo do mês (receitas, despesas, saldo) ──
router.get("/resumo", auth, async (req, res) => {
  const mes = parseInt(req.query.mes);
  const ano = parseInt(req.query.ano);
  try {
    const [[row]] = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END), 0) AS total_receitas,
        COALESCE(SUM(CASE WHEN tipo IN ('despesa','cartao') THEN valor ELSE 0 END), 0) AS total_despesas,
        COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END), 0) AS saldo
       FROM Transacoes
       WHERE usuario_id=? AND MONTH(data)=? AND YEAR(data)=?
         AND deleted_at IS NULL AND IFNULL(is_transferencia, 0) = 0`,
      [req.usuarioId, mes, ano],
    );
    res.json(row);
  } catch (err) {
    console.error("[Resumo]", err.message);
    res.status(500).json({ erro: "Erro ao buscar resumo." });
  }
});

// ── Gastos/receitas por categoria ──
router.get("/por-categoria", auth, async (req, res) => {
  const mes = parseInt(req.query.mes);
  const ano = parseInt(req.query.ano);
  const tipo = req.query.tipo || "despesa";
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.nome, c.cor, c.icone,
              COALESCE(SUM(t.valor), 0) AS total
       FROM Categorias c
       INNER JOIN Transacoes t
         ON t.categoria_id = c.id
         AND MONTH(t.data)=? AND YEAR(t.data)=?
         AND t.deleted_at IS NULL
         AND (t.tipo=? OR (? = 'despesa' AND t.tipo='cartao'))
       WHERE c.usuario_id=? AND c.deleted_at IS NULL
       GROUP BY c.id, c.nome, c.cor, c.icone
       ORDER BY total DESC`,
      [mes, ano, tipo, tipo, req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    console.error("[PorCategoria]", err.message);
    res.status(500).json({ erro: "Erro ao buscar categorias." });
  }
});

// ── Saldo atual de cada conta ──
router.get("/saldo-contas", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.nome, c.cor, c.tipo,
         c.saldo_inicial + COALESCE((
           SELECT SUM(CASE WHEN t.tipo='receita' THEN t.valor ELSE -t.valor END)
           FROM Transacoes t WHERE t.conta_id=c.id AND t.deleted_at IS NULL
         ), 0) AS saldo_atual
       FROM Contas c WHERE c.usuario_id=?
       ORDER BY c.nome`,
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    console.error("[SaldoContas]", err.message);
    res.status(500).json({ erro: "Erro ao buscar saldos." });
  }
});

// ── Evolução mensal (últimos 6 meses) ──
router.get("/evolucao", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         YEAR(data)  AS ano,
         MONTH(data) AS mes,
         SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END) AS receitas,
         SUM(CASE WHEN tipo IN ('despesa','cartao') THEN valor ELSE 0 END) AS despesas
       FROM Transacoes
       WHERE usuario_id=? AND deleted_at IS NULL
         AND data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY YEAR(data), MONTH(data)
       ORDER BY ano, mes`,
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    console.error("[Evolucao]", err.message);
    res.status(500).json({ erro: "Erro ao buscar evolução." });
  }
});

// ── Resumo anual (12 meses de um ano) ──
router.get("/anual", auth, async (req, res) => {
  const ano = parseInt(req.query.ano) || new Date().getFullYear();
  try {
    const [rows] = await db.query(
      `SELECT
         MONTH(data) AS mes,
         SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END)                   AS receitas,
         SUM(CASE WHEN tipo IN ('despesa','cartao') THEN valor ELSE 0 END)     AS despesas
       FROM Transacoes
       WHERE usuario_id=? AND YEAR(data)=? AND deleted_at IS NULL
       GROUP BY MONTH(data)
       ORDER BY mes`,
      [req.usuarioId, ano],
    );
    // Preenche meses sem dados com zero
    const meses = Array.from({ length: 12 }, (_, i) => {
      const found = rows.find((r) => r.mes === i + 1);
      return {
        mes: i + 1,
        receitas: parseFloat(found?.receitas || 0),
        despesas: parseFloat(found?.despesas || 0),
        saldo: parseFloat(found?.receitas || 0) - parseFloat(found?.despesas || 0),
      };
    });
    const totais = meses.reduce(
      (acc, m) => ({
        receitas: acc.receitas + m.receitas,
        despesas: acc.despesas + m.despesas,
        saldo: acc.saldo + m.saldo,
      }),
      { receitas: 0, despesas: 0, saldo: 0 },
    );
    res.json({ ano, meses, totais });
  } catch (err) {
    console.error("[Anual]", err.message);
    res.status(500).json({ erro: "Erro ao buscar resumo anual." });
  }
});

module.exports = router;
