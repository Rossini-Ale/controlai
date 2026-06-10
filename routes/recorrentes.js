// routes/recorrentes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");
const { calcularPrimeiraData, toDateStr } = require("./recorrentes-engine");

// ── GET / — Listar recorrências do usuário ──
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*,
              c.nome  AS categoria_nome,
              c.cor   AS categoria_cor,
              c.icone AS categoria_icone,
              ct.nome AS conta_nome
       FROM TransacoesRecorrentes r
       LEFT JOIN Categorias c  ON r.categoria_id = c.id
       LEFT JOIN Contas     ct ON r.conta_id     = ct.id
       WHERE r.usuario_id = ?
       ORDER BY r.ativa DESC, r.proxima_geracao ASC`,
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar recorrências." });
  }
});

// ── GET /vencendo — Recorrentes vencendo nos próximos N dias ──
// IMPORTANTE: deve ficar antes de GET /:id para não ser capturado como param
router.get("/vencendo", auth, async (req, res) => {
  const dias = parseInt(req.query.dias) || 7;
  try {
    const hoje = new Date().toISOString().split("T")[0];
    const limite = new Date(Date.now() + dias * 86400000)
      .toISOString()
      .split("T")[0];
    const [rows] = await db.query(
      `SELECT r.*,
              c.nome  AS categoria_nome,
              c.cor   AS categoria_cor,
              c.icone AS categoria_icone,
              ct.nome AS conta_nome
       FROM TransacoesRecorrentes r
       LEFT JOIN Categorias c  ON r.categoria_id = c.id
       LEFT JOIN Contas     ct ON r.conta_id     = ct.id
       WHERE r.usuario_id = ?
         AND r.ativa = 1
         AND r.proxima_geracao BETWEEN ? AND ?
       ORDER BY r.proxima_geracao ASC`,
      [req.usuarioId, hoje, limite],
    );
    res.json(rows);
  } catch (err) {
    console.error("[Recorrentes /vencendo]", err.message);
    res.status(500).json({ erro: "Erro ao buscar recorrentes vencendo." });
  }
});

// ── GET /:id — Detalhe de uma recorrência ──
router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*,
              c.nome  AS categoria_nome,
              c.cor   AS categoria_cor,
              ct.nome AS conta_nome
       FROM TransacoesRecorrentes r
       LEFT JOIN Categorias c  ON r.categoria_id = c.id
       LEFT JOIN Contas     ct ON r.conta_id     = ct.id
       WHERE r.id = ? AND r.usuario_id = ?`,
      [req.params.id, req.usuarioId],
    );
    if (rows.length === 0)
      return res.status(404).json({ erro: "Recorrência não encontrada." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar recorrência." });
  }
});

// ── POST / — Criar recorrência ──
router.post("/", auth, async (req, res) => {
  const {
    conta_id,
    categoria_id,
    tipo,
    descricao,
    valor,
    frequencia,
    dia_vencimento,
    data_inicio,
    data_fim,
    observacao,
  } = req.body;

  if (!tipo || !descricao || !valor || !frequencia || !data_inicio) {
    return res.status(400).json({
      erro: "Campos obrigatórios: tipo, descricao, valor, frequencia, data_inicio.",
    });
  }

  if (!["receita", "despesa"].includes(tipo)) {
    return res
      .status(400)
      .json({ erro: "Tipo deve ser 'receita' ou 'despesa'." });
  }

  const FREQUENCIAS = [
    "diaria",
    "semanal",
    "quinzenal",
    "mensal",
    "bimestral",
    "trimestral",
    "semestral",
    "anual",
  ];
  if (!FREQUENCIAS.includes(frequencia)) {
    return res.status(400).json({ erro: "Frequência inválida." });
  }

  const diaVenc = parseInt(dia_vencimento) || 1;

  try {
    // Calcula a primeira data de geração
    const primeiraData = calcularPrimeiraData(data_inicio, frequencia, diaVenc);
    const proximaStr = toDateStr(primeiraData);

    const [result] = await db.query(
      `INSERT INTO TransacoesRecorrentes
         (usuario_id, conta_id, categoria_id, tipo, descricao, valor,
          frequencia, dia_vencimento, data_inicio, data_fim, proxima_geracao, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.usuarioId,
        conta_id || null,
        categoria_id || null,
        tipo,
        descricao,
        parseFloat(valor),
        frequencia,
        diaVenc,
        data_inicio,
        data_fim || null,
        proximaStr,
        observacao || null,
      ],
    );

    res.status(201).json({
      id: result.insertId,
      proxima_geracao: proximaStr,
      mensagem: "Recorrência criada!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao criar recorrência." });
  }
});

// ── PUT /:id — Editar recorrência ──
router.put("/:id", auth, async (req, res) => {
  const {
    conta_id,
    categoria_id,
    tipo,
    descricao,
    valor,
    frequencia,
    dia_vencimento,
    data_inicio,
    data_fim,
    observacao,
    ativa,
  } = req.body;

  try {
    // Verifica que pertence ao usuário
    const [check] = await db.query(
      "SELECT id FROM TransacoesRecorrentes WHERE id = ? AND usuario_id = ?",
      [req.params.id, req.usuarioId],
    );
    if (check.length === 0)
      return res.status(404).json({ erro: "Recorrência não encontrada." });

    const diaVenc = parseInt(dia_vencimento) || 1;
    const primeiraData = calcularPrimeiraData(data_inicio, frequencia, diaVenc);
    const proximaStr = toDateStr(primeiraData);

    await db.query(
      `UPDATE TransacoesRecorrentes
       SET conta_id       = ?,
           categoria_id   = ?,
           tipo           = ?,
           descricao      = ?,
           valor          = ?,
           frequencia     = ?,
           dia_vencimento = ?,
           data_inicio    = ?,
           data_fim       = ?,
           proxima_geracao = ?,
           ultima_geracao = NULL,
           observacao     = ?,
           ativa          = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        conta_id || null,
        categoria_id || null,
        tipo,
        descricao,
        parseFloat(valor),
        frequencia,
        diaVenc,
        data_inicio,
        data_fim || null,
        proximaStr,
        observacao || null,
        ativa !== undefined ? (ativa ? 1 : 0) : 1,
        req.params.id,
        req.usuarioId,
      ],
    );

    res.json({
      mensagem: "Recorrência atualizada!",
      proxima_geracao: proximaStr,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar recorrência." });
  }
});

// ── PATCH /:id/ativar — Ativar/Pausar ──
router.patch("/:id/ativar", auth, async (req, res) => {
  const { ativa } = req.body;
  try {
    await db.query(
      "UPDATE TransacoesRecorrentes SET ativa = ? WHERE id = ? AND usuario_id = ?",
      [ativa ? 1 : 0, req.params.id, req.usuarioId],
    );
    res.json({
      mensagem: ativa ? "Recorrência ativada!" : "Recorrência pausada!",
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar status." });
  }
});

// ── DELETE /:id — Deletar recorrência ──
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM TransacoesRecorrentes WHERE id = ? AND usuario_id = ?",
      [req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Recorrência deletada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar recorrência." });
  }
});

// ── GET /:id/historico — Transações geradas por esta recorrência ──
router.get("/:id/historico", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, c.nome AS categoria_nome, c.cor AS categoria_cor, ct.nome AS conta_nome
       FROM Transacoes t
       LEFT JOIN Categorias c  ON t.categoria_id = c.id
       LEFT JOIN Contas     ct ON t.conta_id     = ct.id
       WHERE t.recorrente_id = ? AND t.usuario_id = ?
       ORDER BY t.data DESC`,
      [req.params.id, req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar histórico." });
  }
});

module.exports = router;
