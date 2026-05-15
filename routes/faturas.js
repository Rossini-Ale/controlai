const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Buscar ou criar fatura do mês
async function getOuCriarFatura(cartao_id, usuario_id, mes, ano) {
  const [rows] = await db.query(
    "SELECT * FROM FaturasCartao WHERE cartao_id=? AND mes=? AND ano=?",
    [cartao_id, mes, ano],
  );
  if (rows.length > 0) return rows[0];

  const [result] = await db.query(
    "INSERT INTO FaturasCartao (cartao_id, usuario_id, mes, ano) VALUES (?, ?, ?, ?)",
    [cartao_id, usuario_id, mes, ano],
  );
  return {
    id: result.insertId,
    cartao_id,
    usuario_id,
    mes,
    ano,
    valor_total: 0,
    status: "aberta",
  };
}

// Listar faturas de um cartão
router.get("/:cartao_id", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT f.*,
        COALESCE((SELECT SUM(t.valor) FROM Transacoes t WHERE t.fatura_id = f.id), 0) as valor_total
       FROM FaturasCartao f
       WHERE f.cartao_id = ? AND f.usuario_id = ?
       ORDER BY f.ano DESC, f.mes DESC`,
      [req.params.cartao_id, req.usuarioId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar faturas." });
  }
});

// Listar transações de uma fatura
router.get("/:cartao_id/:mes/:ano/transacoes", auth, async (req, res) => {
  const { cartao_id, mes, ano } = req.params;
  try {
    const fatura = await getOuCriarFatura(cartao_id, req.usuarioId, mes, ano);
    const [rows] = await db.query(
      `SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
       FROM Transacoes t
       LEFT JOIN Categorias c ON t.categoria_id = c.id
       WHERE t.fatura_id = ?
       ORDER BY t.data ASC`,
      [fatura.id],
    );
    res.json({ fatura, transacoes: rows });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar transações da fatura." });
  }
});

// Lançar despesa no cartão (com suporte a parcelamento)
router.post("/:cartao_id/lancar", auth, async (req, res) => {
  const { cartao_id } = req.params;
  const { categoria_id, descricao, valor, data, observacao, parcelas } =
    req.body;

  if (!descricao || !valor || !data) {
    return res.status(400).json({ erro: "Preencha descrição, valor e data." });
  }

  const totalParcelas = parseInt(parcelas) || 1;
  const valorParcela = parseFloat((valor / totalParcelas).toFixed(2));
  const dataBase = new Date(data + "T00:00:00");
  const parcela_ref = crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString();

  try {
    const ids = [];
    for (let i = 0; i < totalParcelas; i++) {
      const d = new Date(dataBase);
      d.setMonth(d.getMonth() + i);
      const mes = d.getMonth() + 1;
      const ano = d.getFullYear();

      const fatura = await getOuCriarFatura(cartao_id, req.usuarioId, mes, ano);

      const descricaoFinal =
        totalParcelas > 1
          ? `${descricao} (${i + 1}/${totalParcelas})`
          : descricao;

      const dataFormatada = `${ano}-${String(mes).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const [result] = await db.query(
        `INSERT INTO Transacoes 
         (usuario_id, cartao_id, fatura_id, categoria_id, tipo, descricao, valor, data, observacao, parcelas, parcela_atual, parcela_ref)
         VALUES (?, ?, ?, ?, 'despesa', ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.usuarioId,
          cartao_id,
          fatura.id,
          categoria_id,
          descricaoFinal,
          valorParcela,
          dataFormatada,
          observacao || null,
          totalParcelas,
          i + 1,
          parcela_ref,
        ],
      );
      ids.push(result.insertId);
    }
    res
      .status(201)
      .json({ mensagem: `${totalParcelas} lançamento(s) criado(s)!`, ids });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao lançar despesa no cartão." });
  }
});

// Pagar fatura
router.post("/:cartao_id/:mes/:ano/pagar", auth, async (req, res) => {
  const { cartao_id, mes, ano } = req.params;
  const { conta_id, data_pagamento } = req.body;

  try {
    const fatura = await getOuCriarFatura(cartao_id, req.usuarioId, mes, ano);

    const [[totais]] = await db.query(
      "SELECT COALESCE(SUM(valor), 0) as total FROM Transacoes WHERE fatura_id = ?",
      [fatura.id],
    );
    const valorTotal = parseFloat(totais.total) || 0;

    if (valorTotal === 0) {
      return res.status(400).json({ erro: "Fatura sem lançamentos." });
    }

    // Lança saída na conta bancária
    await db.query(
      `INSERT INTO Transacoes 
       (usuario_id, conta_id, tipo, descricao, valor, data)
       VALUES (?, ?, 'despesa', ?, ?, ?)`,
      [
        req.usuarioId,
        conta_id,
        `Pagamento fatura ${mes}/${ano}`,
        valorTotal,
        data_pagamento,
      ],
    );

    // Atualiza status da fatura
    await db.query(
      "UPDATE FaturasCartao SET status=?, data_pagamento=?, conta_pagamento_id=?, valor_total=? WHERE id=?",
      ["paga", data_pagamento, conta_id, valorTotal, fatura.id],
    );

    res.json({ mensagem: "Fatura paga!", valor: valorTotal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao pagar fatura." });
  }
});

// Fechar fatura manualmente
router.patch("/:cartao_id/:mes/:ano/fechar", auth, async (req, res) => {
  const { cartao_id, mes, ano } = req.params;
  try {
    const fatura = await getOuCriarFatura(cartao_id, req.usuarioId, mes, ano);
    await db.query("UPDATE FaturasCartao SET status=? WHERE id=?", [
      "fechada",
      fatura.id,
    ]);
    res.json({ mensagem: "Fatura fechada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao fechar fatura." });
  }
});

module.exports = router;
