// routes/transferencias.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");
const { randomUUID } = require("crypto");

// ── POST / — Criar transferência ──
router.post("/", auth, async (req, res) => {
  const {
    conta_origem_id,
    conta_destino_id,
    valor,
    data,
    descricao,
    observacao,
  } = req.body;

  if (!conta_origem_id || !conta_destino_id || !valor || !data) {
    return res.status(400).json({
      erro: "Campos obrigatórios: conta_origem_id, conta_destino_id, valor, data.",
    });
  }

  if (conta_origem_id === conta_destino_id) {
    return res
      .status(400)
      .json({ erro: "Conta de origem e destino devem ser diferentes." });
  }

  const valorFloat = parseFloat(valor);
  if (isNaN(valorFloat) || valorFloat <= 0) {
    return res.status(400).json({ erro: "Valor deve ser maior que zero." });
  }

  // Verifica que ambas as contas pertencem ao usuário
  const [contas] = await db.query(
    "SELECT id FROM Contas WHERE id IN (?, ?) AND usuario_id = ?",
    [conta_origem_id, conta_destino_id, req.usuarioId],
  );
  if (contas.length < 2) {
    return res.status(403).json({ erro: "Conta não encontrada." });
  }

  const transferencia_id = randomUUID();
  const desc = descricao || "Transferência entre contas";

  try {
    // Despesa na conta de origem
    const [resOrigem] = await db.query(
      `INSERT INTO Transacoes
         (usuario_id, conta_id, tipo, descricao, valor, data, observacao, transferencia_id, is_transferencia)
       VALUES (?, ?, 'despesa', ?, ?, ?, ?, ?, 1)`,
      [
        req.usuarioId,
        conta_origem_id,
        desc,
        valorFloat,
        data,
        observacao || null,
        transferencia_id,
      ],
    );

    // Receita na conta de destino
    const [resDestino] = await db.query(
      `INSERT INTO Transacoes
         (usuario_id, conta_id, tipo, descricao, valor, data, observacao, transferencia_id, is_transferencia)
       VALUES (?, ?, 'receita', ?, ?, ?, ?, ?, 1)`,
      [
        req.usuarioId,
        conta_destino_id,
        desc,
        valorFloat,
        data,
        observacao || null,
        transferencia_id,
      ],
    );

    res.status(201).json({
      mensagem: "Transferência realizada!",
      transferencia_id,
      id_origem: resOrigem.insertId,
      id_destino: resDestino.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao realizar transferência." });
  }
});

// ── GET / — Listar transferências do usuário ──
router.get("/", auth, async (req, res) => {
  const { mes, ano } = req.query;
  try {
    let query = `
      SELECT
        t.transferencia_id,
        t.data,
        t.valor,
        t.descricao,
        t.observacao,
        t.id           AS id_despesa,
        co.id          AS conta_origem_id,
        co.nome        AS conta_origem,
        co.cor         AS conta_origem_cor,
        cd.id          AS conta_destino_id,
        cd.nome        AS conta_destino,
        cd.cor         AS conta_destino_cor
      FROM Transacoes t
      JOIN Contas co ON t.conta_id = co.id
      JOIN Transacoes t2
        ON t2.transferencia_id = t.transferencia_id AND t2.tipo = 'receita'
      JOIN Contas cd ON t2.conta_id = cd.id
      WHERE t.usuario_id = ?
        AND t.is_transferencia = 1
        AND t.tipo = 'despesa'
    `;
    const params = [req.usuarioId];

    if (mes && ano) {
      query += " AND MONTH(t.data) = ? AND YEAR(t.data) = ?";
      params.push(mes, ano);
    }

    query += " ORDER BY t.data DESC, t.created_at DESC";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar transferências." });
  }
});

// ── GET /:transferencia_id — Detalhe de uma transferência ──
router.get("/:transferencia_id", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, ct.nome AS conta_nome, ct.cor AS conta_cor
       FROM Transacoes t
       JOIN Contas ct ON t.conta_id = ct.id
       WHERE t.transferencia_id = ? AND t.usuario_id = ?`,
      [req.params.transferencia_id, req.usuarioId],
    );
    if (rows.length === 0)
      return res.status(404).json({ erro: "Transferência não encontrada." });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar transferência." });
  }
});

// ── PUT /:transferencia_id — Editar transferência ──
router.put("/:transferencia_id", auth, async (req, res) => {
  const {
    conta_origem_id,
    conta_destino_id,
    valor,
    data,
    descricao,
    observacao,
  } = req.body;

  if (!conta_origem_id || !conta_destino_id || !valor || !data) {
    return res
      .status(400)
      .json({ erro: "Preencha todos os campos obrigatórios." });
  }

  if (conta_origem_id === conta_destino_id) {
    return res
      .status(400)
      .json({ erro: "Conta de origem e destino devem ser diferentes." });
  }

  const valorFloat = parseFloat(valor);
  if (isNaN(valorFloat) || valorFloat <= 0) {
    return res.status(400).json({ erro: "Valor deve ser maior que zero." });
  }

  const desc = descricao || "Transferência entre contas";

  try {
    // Verifica que pertence ao usuário
    const [check] = await db.query(
      "SELECT id, tipo FROM Transacoes WHERE transferencia_id = ? AND usuario_id = ?",
      [req.params.transferencia_id, req.usuarioId],
    );
    if (check.length < 2)
      return res.status(404).json({ erro: "Transferência não encontrada." });

    const despesa = check.find((t) => t.tipo === "despesa");
    const receita = check.find((t) => t.tipo === "receita");

    // Atualiza despesa (origem)
    await db.query(
      `UPDATE Transacoes
       SET conta_id = ?, valor = ?, data = ?, descricao = ?, observacao = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        conta_origem_id,
        valorFloat,
        data,
        desc,
        observacao || null,
        despesa.id,
        req.usuarioId,
      ],
    );

    // Atualiza receita (destino)
    await db.query(
      `UPDATE Transacoes
       SET conta_id = ?, valor = ?, data = ?, descricao = ?, observacao = ?
       WHERE id = ? AND usuario_id = ?`,
      [
        conta_destino_id,
        valorFloat,
        data,
        desc,
        observacao || null,
        receita.id,
        req.usuarioId,
      ],
    );

    res.json({ mensagem: "Transferência atualizada!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao atualizar transferência." });
  }
});

// ── DELETE /:transferencia_id — Deletar o par inteiro ──
router.delete("/:transferencia_id", auth, async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM Transacoes WHERE transferencia_id = ? AND usuario_id = ?",
      [req.params.transferencia_id, req.usuarioId],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ erro: "Transferência não encontrada." });
    res.json({ mensagem: "Transferência deletada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar transferência." });
  }
});

module.exports = router;
