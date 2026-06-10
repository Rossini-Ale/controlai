const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// ── Listar transações (exclui deletadas) ──
router.get("/", auth, async (req, res) => {
  const { mes, ano, tipo, categoria_id, conta_id, page, limit } = req.query;
  const paginaAtual = Math.max(1, parseInt(page) || 1);
  const porPagina = Math.min(100, parseInt(limit) || 30);
  const offset = (paginaAtual - 1) * porPagina;

  try {
    let where = "WHERE t.usuario_id = ? AND t.deleted_at IS NULL";
    const params = [req.usuarioId];

    if (mes && ano) {
      where += " AND MONTH(t.data) = ? AND YEAR(t.data) = ?";
      params.push(mes, ano);
    }
    if (tipo === "transferencia") {
      where += " AND IFNULL(t.is_transferencia, 0) = 1";
    } else if (tipo) {
      where += " AND t.tipo = ? AND IFNULL(t.is_transferencia, 0) = 0";
      params.push(tipo);
    }
    if (categoria_id) {
      where += " AND t.categoria_id = ?";
      params.push(categoria_id);
    }
    if (conta_id) {
      where += " AND t.conta_id = ?";
      params.push(conta_id);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM Transacoes t ${where}`,
      params,
    );

    const [rows] = await db.query(
      `SELECT t.*,
              c.nome  AS categoria_nome,
              c.cor   AS categoria_cor,
              c.icone AS categoria_icone,
              ct.nome AS conta_nome
       FROM Transacoes t
       LEFT JOIN Categorias c  ON t.categoria_id = c.id
       LEFT JOIN Contas     ct ON t.conta_id     = ct.id
       ${where}
       ORDER BY t.data DESC, t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, porPagina, offset],
    );

    res.json({
      data: rows,
      paginacao: {
        total,
        pagina: paginaAtual,
        por_pagina: porPagina,
        total_paginas: Math.ceil(total / porPagina),
        tem_proxima: paginaAtual < Math.ceil(total / porPagina),
        tem_anterior: paginaAtual > 1,
      },
    });
  } catch (err) {
    console.error("[Transacoes GET]", err.message);
    res.status(500).json({ erro: "Erro ao buscar transações." });
  }
});

// ── Buscar por texto ──
router.get("/buscar", auth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2)
    return res.status(400).json({ erro: "Termo de busca muito curto." });
  try {
    const termo = `%${q.trim()}%`;
    const [rows] = await db.query(
      `SELECT t.*,
              c.nome  AS categoria_nome,
              c.cor   AS categoria_cor,
              c.icone AS categoria_icone,
              ct.nome AS conta_nome
       FROM Transacoes t
       LEFT JOIN Categorias c  ON t.categoria_id = c.id
       LEFT JOIN Contas     ct ON t.conta_id     = ct.id
       WHERE t.usuario_id = ? AND t.deleted_at IS NULL
         AND (t.descricao LIKE ? OR t.observacao LIKE ? OR c.nome LIKE ?)
       ORDER BY t.data DESC, t.created_at DESC
       LIMIT 50`,
      [req.usuarioId, termo, termo, termo],
    );
    res.json(rows);
  } catch (err) {
    console.error("[Transacoes /buscar]", err.message);
    res.status(500).json({ erro: "Erro ao buscar." });
  }
});

// ── Listar lixeira ── (deve vir antes de /:id)
router.get("/lixeira", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*,
              c.nome  AS categoria_nome,
              c.cor   AS categoria_cor,
              c.icone AS categoria_icone,
              ct.nome AS conta_nome
       FROM Transacoes t
       LEFT JOIN Categorias c  ON t.categoria_id = c.id
       LEFT JOIN Contas     ct ON t.conta_id     = ct.id
       WHERE t.usuario_id = ? AND t.deleted_at IS NOT NULL
       ORDER BY t.deleted_at DESC
       LIMIT 100`,
      [req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar lixeira." });
  }
});

// ── Exportar CSV ── (deve vir antes de /:id)
router.get("/exportar", auth, async (req, res) => {
  const { mes, ano, tipo, categoria_id, conta_id } = req.query;
  try {
    let where = "WHERE t.usuario_id = ? AND t.deleted_at IS NULL";
    const params = [req.usuarioId];
    if (mes && ano) {
      where += " AND MONTH(t.data)=? AND YEAR(t.data)=?";
      params.push(mes, ano);
    }
    if (tipo) { where += " AND t.tipo=?"; params.push(tipo); }
    if (categoria_id) { where += " AND t.categoria_id=?"; params.push(categoria_id); }
    if (conta_id) { where += " AND t.conta_id=?"; params.push(conta_id); }

    const [rows] = await db.query(
      `SELECT t.data, t.tipo, t.descricao, t.valor, t.observacao,
              c.nome AS categoria_nome, ct.nome AS conta_nome
       FROM Transacoes t
       LEFT JOIN Categorias c  ON t.categoria_id = c.id
       LEFT JOIN Contas     ct ON t.conta_id = ct.id
       ${where}
       ORDER BY t.data DESC, t.created_at DESC`,
      params,
    );

    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const tipoLabel = { receita: "Receita", despesa: "Despesa", cartao: "Cartão" };
    const header = "Data,Tipo,Descrição,Valor,Categoria,Conta,Observação";
    const linhas = rows.map((r) => {
      const data = (r.data instanceof Date ? r.data : new Date(r.data))
        .toISOString().split("T")[0];
      return [
        data,
        tipoLabel[r.tipo] || r.tipo,
        esc(r.descricao),
        String(r.valor).replace(".", ","),
        esc(r.categoria_nome || ""),
        esc(r.conta_nome || ""),
        esc(r.observacao || ""),
      ].join(",");
    });

    const csv = "﻿" + header + "\n" + linhas.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="transacoes.csv"');
    res.send(csv);
  } catch (err) {
    console.error("[Exportar CSV]", err.message);
    res.status(500).json({ erro: "Erro ao exportar." });
  }
});

// ── Buscar uma transação por ID ──
router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*,
              c.nome  AS categoria_nome,
              c.cor   AS categoria_cor,
              c.icone AS categoria_icone,
              ct.nome AS conta_nome
       FROM Transacoes t
       LEFT JOIN Categorias c  ON t.categoria_id = c.id
       LEFT JOIN Contas     ct ON t.conta_id     = ct.id
       WHERE t.id = ? AND t.usuario_id = ? AND t.deleted_at IS NULL`,
      [req.params.id, req.usuarioId],
    );
    if (rows.length === 0)
      return res.status(404).json({ erro: "Transação não encontrada." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar transação." });
  }
});

const TIPOS_VALIDOS = ["receita", "despesa", "cartao"];

function validarTransacao(body) {
  const { conta_id, tipo, descricao, valor, data } = body;
  if (!conta_id) return "conta_id é obrigatório.";
  if (!TIPOS_VALIDOS.includes(tipo)) return `tipo deve ser: ${TIPOS_VALIDOS.join(", ")}.`;
  if (!descricao || String(descricao).trim().length === 0) return "descricao é obrigatória.";
  if (String(descricao).length > 255) return "descricao deve ter no máximo 255 caracteres.";
  const v = parseFloat(valor);
  if (isNaN(v) || v <= 0) return "valor deve ser um número positivo.";
  if (!data || isNaN(Date.parse(data))) return "data inválida.";
  return null;
}

// ── Criar transação ──
router.post("/", auth, async (req, res) => {
  const { conta_id, categoria_id, tipo, descricao, valor, data, observacao } =
    req.body;
  const erroValidacao = validarTransacao(req.body);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });
  try {
    const [result] = await db.query(
      `INSERT INTO Transacoes (usuario_id, conta_id, categoria_id, tipo, descricao, valor, data, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.usuarioId,
        conta_id,
        categoria_id,
        tipo,
        String(descricao).trim(),
        parseFloat(valor),
        data,
        observacao || null,
      ],
    );
    res
      .status(201)
      .json({ id: result.insertId, mensagem: "Transação criada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao criar transação." });
  }
});

// ── Editar transação ──
router.put("/:id", auth, async (req, res) => {
  const { conta_id, categoria_id, tipo, descricao, valor, data, observacao } =
    req.body;
  const erroValidacao = validarTransacao(req.body);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });
  try {
    await db.query(
      `UPDATE Transacoes SET conta_id=?, categoria_id=?, tipo=?, descricao=?, valor=?, data=?, observacao=?
       WHERE id=? AND usuario_id=? AND deleted_at IS NULL`,
      [
        conta_id,
        categoria_id,
        tipo,
        String(descricao).trim(),
        parseFloat(valor),
        data,
        observacao,
        req.params.id,
        req.usuarioId,
      ],
    );
    res.json({ mensagem: "Transação atualizada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar transação." });
  }
});

// ── Esvaziar lixeira ── (deve vir antes de DELETE /:id)
router.delete("/lixeira/esvaziar", auth, async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM Transacoes WHERE usuario_id=? AND deleted_at IS NOT NULL",
      [req.usuarioId],
    );
    res.json({
      mensagem: "Lixeira esvaziada!",
      deletados: result.affectedRows,
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao esvaziar lixeira." });
  }
});

// ── Soft delete — manda para lixeira ──
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query(
      "UPDATE Transacoes SET deleted_at = NOW() WHERE id=? AND usuario_id=? AND deleted_at IS NULL",
      [req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Transação movida para a lixeira." });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar transação." });
  }
});

// ── Restaurar da lixeira ──
router.patch("/:id/restaurar", auth, async (req, res) => {
  try {
    await db.query(
      "UPDATE Transacoes SET deleted_at = NULL WHERE id=? AND usuario_id=?",
      [req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Transação restaurada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao restaurar transação." });
  }
});

// ── Deletar permanentemente da lixeira ──
router.delete("/:id/permanente", auth, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM Transacoes WHERE id=? AND usuario_id=? AND deleted_at IS NOT NULL",
      [req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Transação deletada permanentemente." });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar permanentemente." });
  }
});

// ── Duplicar transação ──
router.post("/:id/duplicar", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Transacoes WHERE id=? AND usuario_id=? AND deleted_at IS NULL",
      [req.params.id, req.usuarioId],
    );
    if (rows.length === 0)
      return res.status(404).json({ erro: "Transação não encontrada." });
    const orig = rows[0];
    const data = req.body.data || new Date().toISOString().split("T")[0];
    const valor = req.body.valor || orig.valor;
    const [result] = await db.query(
      `INSERT INTO Transacoes (usuario_id, conta_id, categoria_id, tipo, descricao, valor, data, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.usuarioId,
        orig.conta_id,
        orig.categoria_id,
        orig.tipo,
        orig.descricao,
        valor,
        data,
        orig.observacao || null,
      ],
    );
    res
      .status(201)
      .json({ id: result.insertId, mensagem: "Transação duplicada!" });
  } catch (err) {
    console.error("[Transacoes /duplicar]", err.message);
    res.status(500).json({ erro: "Erro ao duplicar transação." });
  }
});

module.exports = router;
