const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Calcula o período de faturamento atual para um cartão
function getPeriodoFatura(diaFechamento, hoje = new Date()) {
  const dia = hoje.getDate();
  const df = parseInt(diaFechamento) || 10;
  let inicio, fim;
  if (dia > df) {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), df + 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, df);
  } else {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, df + 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth(), df);
  }
  return {
    inicio: inicio.toISOString().split("T")[0],
    fim: fim.toISOString().split("T")[0],
  };
}

// Listar contas — inclui fatura_atual para tipo='cartao'
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Contas WHERE usuario_id = ? ORDER BY nome ASC",
      [req.usuarioId],
    );
    const hoje = new Date();
    for (const conta of rows) {
      if (conta.tipo !== "cartao") continue;
      const { inicio, fim } = getPeriodoFatura(conta.dia_fechamento, hoje);
      const [[{ fatura }]] = await db.query(
        `SELECT COALESCE(SUM(valor), 0) AS fatura FROM Transacoes
         WHERE conta_id=? AND usuario_id=? AND deleted_at IS NULL
         AND tipo='cartao' AND data BETWEEN ? AND ?`,
        [conta.id, req.usuarioId, inicio, fim],
      );
      conta.fatura_atual = parseFloat(fatura) || 0;
      conta.periodo_inicio = inicio;
      conta.periodo_fim = fim;
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar contas." });
  }
});

// Fatura de um cartão num período
router.get("/:id/fatura", auth, async (req, res) => {
  try {
    const [[conta]] = await db.query(
      "SELECT * FROM Contas WHERE id=? AND usuario_id=? AND tipo='cartao'",
      [req.params.id, req.usuarioId],
    );
    if (!conta) return res.status(404).json({ erro: "Cartão não encontrado." });

    const hoje = new Date();
    const mesParam = parseInt(req.query.mes);
    const anoParam = parseInt(req.query.ano);

    let inicio, fim;
    if (mesParam && anoParam) {
      // Período específico: do dia após fechamento do mês anterior até o fechamento do mês solicitado
      const df = conta.dia_fechamento || 10;
      inicio = new Date(anoParam, mesParam - 2, df + 1).toISOString().split("T")[0];
      fim = new Date(anoParam, mesParam - 1, df).toISOString().split("T")[0];
    } else {
      ({ inicio, fim } = getPeriodoFatura(conta.dia_fechamento, hoje));
    }

    const [transacoes] = await db.query(
      `SELECT t.*, c.nome AS categoria_nome, c.icone AS categoria_icone
       FROM Transacoes t
       LEFT JOIN Categorias c ON c.id = t.categoria_id
       WHERE t.conta_id=? AND t.usuario_id=? AND t.deleted_at IS NULL
       AND t.tipo='cartao' AND t.data BETWEEN ? AND ?
       ORDER BY t.data DESC`,
      [req.params.id, req.usuarioId, inicio, fim],
    );

    const total = transacoes.reduce((s, t) => s + parseFloat(t.valor), 0);
    res.json({ transacoes, total, inicio, fim, conta });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar fatura." });
  }
});

// Criar conta
router.post("/", auth, async (req, res) => {
  const { nome, tipo, saldo_inicial, cor, limite, dia_fechamento, dia_vencimento } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: "Nome obrigatório." });
  try {
    const [result] = await db.query(
      "INSERT INTO Contas (usuario_id, nome, tipo, saldo_inicial, cor, limite, dia_fechamento, dia_vencimento) VALUES (?,?,?,?,?,?,?,?)",
      [req.usuarioId, nome.trim(), tipo || "corrente", saldo_inicial || 0, cor || "#10b981",
       limite || 0, dia_fechamento || null, dia_vencimento || null],
    );
    res.status(201).json({ id: result.insertId, mensagem: "Conta criada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao criar conta." });
  }
});

// Editar conta
router.put("/:id", auth, async (req, res) => {
  const { nome, tipo, saldo_inicial, cor, limite, dia_fechamento, dia_vencimento } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: "Nome obrigatório." });
  try {
    await db.query(
      `UPDATE Contas SET nome=?, tipo=?, saldo_inicial=?, cor=?,
       limite=?, dia_fechamento=?, dia_vencimento=?
       WHERE id=? AND usuario_id=?`,
      [nome.trim(), tipo || "corrente", saldo_inicial || 0, cor || "#10b981",
       limite || 0, dia_fechamento || null, dia_vencimento || null,
       req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Conta atualizada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar conta." });
  }
});

// Deletar conta
router.delete("/:id", auth, async (req, res) => {
  try {
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM Transacoes WHERE conta_id=? AND deleted_at IS NULL",
      [req.params.id],
    );
    if (total > 0) {
      return res.status(400).json({
        erro: `Esta conta possui ${total} transação(ões). Remova-as antes de excluir.`,
      });
    }
    await db.query("DELETE FROM Contas WHERE id=? AND usuario_id=?", [req.params.id, req.usuarioId]);
    res.json({ mensagem: "Conta deletada!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao deletar conta." });
  }
});

module.exports = router;
