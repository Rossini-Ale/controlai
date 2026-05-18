const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Listar transações (com filtros opcionais)
router.get("/", auth, async (req, res) => {
  const { mes, ano, tipo, categoria_id, conta_id } = req.query;
  try {
    let query = `
      SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor,
             c.icone as categoria_icone, ct.nome as conta_nome
      FROM Transacoes t
      LEFT JOIN Categorias c ON t.categoria_id = c.id
      LEFT JOIN Contas ct ON t.conta_id = ct.id
      WHERE t.usuario_id = ?
    `;
    const params = [req.usuarioId];

    if (mes && ano) {
      query += " AND MONTH(t.data) = ? AND YEAR(t.data) = ?";
      params.push(mes, ano);
    }
    if (tipo) {
      query += " AND t.tipo = ?";
      params.push(tipo);
    }
    if (categoria_id) {
      query += " AND t.categoria_id = ?";
      params.push(categoria_id);
    }
    if (conta_id) {
      query += " AND t.conta_id = ?";
      params.push(conta_id);
    }

    query += " ORDER BY t.data DESC, t.created_at DESC";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar transações." });
  }
});

// Criar transação
router.post("/", auth, async (req, res) => {
  const { conta_id, categoria_id, tipo, descricao, valor, data, observacao } =
    req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO Transacoes 
       (usuario_id, conta_id, categoria_id, tipo, descricao, valor, data, observacao) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.usuarioId,
        conta_id,
        categoria_id,
        tipo,
        descricao,
        valor,
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

// Editar transação
router.put("/:id", auth, async (req, res) => {
  const { conta_id, categoria_id, tipo, descricao, valor, data, observacao } =
    req.body;
  try {
    await db.query(
      `UPDATE Transacoes 
       SET conta_id=?, categoria_id=?, tipo=?, descricao=?, valor=?, data=?, observacao=?
       WHERE id=? AND usuario_id=?`,
      [
        conta_id,
        categoria_id,
        tipo,
        descricao,
        valor,
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

// Deletar transação
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query("DELETE FROM Transacoes WHERE id=? AND usuario_id=?", [
      req.params.id,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Transação deletada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar transação." });
  }
});
// Duplicar transação
router.post("/:id/duplicar", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Transacoes WHERE id = ? AND usuario_id = ?",
      [req.params.id, req.usuarioId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Transação não encontrada." });
    }
    const orig = rows[0];
    // Data padrão: hoje, mas pode ser sobrescrita pelo body
    const data = req.body.data || new Date().toISOString().split("T")[0];
    const valor = req.body.valor || orig.valor;

    const [result] = await db.query(
      `INSERT INTO Transacoes
         (usuario_id, conta_id, categoria_id, tipo, descricao, valor, data, observacao)
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
