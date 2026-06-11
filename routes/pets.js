const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Dashboard: todos os pets com gasto do mês + próximos eventos
router.get("/dashboard", auth, async (req, res) => {
  try {
    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();

    const [pets] = await db.query(
      "SELECT * FROM Pets WHERE usuario_id = ? ORDER BY nome ASC",
      [req.usuarioId],
    );
    if (!pets.length) return res.json({ total_mes: 0, pets: [], proximos_eventos: [] });

    const petIds = pets.map((p) => p.id);
    const placeholders = petIds.map(() => "?").join(",");

    const [gastos] = await db.query(
      `SELECT pet_id, SUM(valor) AS total FROM Transacoes
       WHERE usuario_id=? AND pet_id IN (${placeholders})
       AND deleted_at IS NULL AND tipo IN ('despesa','cartao')
       AND MONTH(data)=? AND YEAR(data)=?
       GROUP BY pet_id`,
      [req.usuarioId, ...petIds, mes, ano],
    );

    const gastoMap = {};
    gastos.forEach((g) => { gastoMap[g.pet_id] = parseFloat(g.total); });

    const totalMes = gastos.reduce((s, g) => s + parseFloat(g.total), 0);
    const petsComGasto = pets.map((p) => ({ ...p, gasto_mes: gastoMap[p.id] || 0 }));

    const hoje = agora.toISOString().split("T")[0];
    const em30 = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [eventos] = await db.query(
      `SELECT e.*, p.nome AS pet_nome, p.emoji AS pet_emoji
       FROM PetEventos e JOIN Pets p ON p.id = e.pet_id
       WHERE e.usuario_id=? AND e.proxima_data BETWEEN ? AND ?
       ORDER BY e.proxima_data ASC LIMIT 5`,
      [req.usuarioId, hoje, em30],
    );

    res.json({ total_mes: totalMes, pets: petsComGasto, proximos_eventos: eventos });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar resumo de pets." });
  }
});

// Listar pets
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM Pets WHERE usuario_id = ? ORDER BY nome ASC",
      [req.usuarioId],
    );
    res.json(rows);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar pets." });
  }
});

// Gastos de um pet num mês
router.get("/:id/gastos", auth, async (req, res) => {
  const m = parseInt(req.query.mes) || new Date().getMonth() + 1;
  const a = parseInt(req.query.ano) || new Date().getFullYear();
  try {
    const [[pet]] = await db.query(
      "SELECT id FROM Pets WHERE id=? AND usuario_id=?",
      [req.params.id, req.usuarioId],
    );
    if (!pet) return res.status(404).json({ erro: "Pet não encontrado." });

    const [transacoes] = await db.query(
      `SELECT t.*, c.nome AS categoria_nome, ct.nome AS conta_nome
       FROM Transacoes t
       LEFT JOIN Categorias c ON c.id = t.categoria_id
       LEFT JOIN Contas ct ON ct.id = t.conta_id
       WHERE t.usuario_id=? AND t.pet_id=? AND t.deleted_at IS NULL
       AND MONTH(t.data)=? AND YEAR(t.data)=?
       ORDER BY t.data DESC`,
      [req.usuarioId, req.params.id, m, a],
    );
    const total = transacoes.reduce(
      (s, t) => s + (t.tipo !== "receita" ? parseFloat(t.valor) : 0), 0,
    );
    res.json({ transacoes, total, mes: m, ano: a });
  } catch {
    res.status(500).json({ erro: "Erro ao buscar gastos." });
  }
});

// Criar pet
router.post("/", auth, async (req, res) => {
  const { nome, especie, raca, data_nascimento, emoji } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: "Nome obrigatório." });
  try {
    const [result] = await db.query(
      "INSERT INTO Pets (usuario_id, nome, especie, raca, data_nascimento, emoji) VALUES (?,?,?,?,?,?)",
      [req.usuarioId, nome.trim(), especie || "cachorro", raca || null, data_nascimento || null, emoji || "🐾"],
    );
    res.status(201).json({ id: result.insertId, mensagem: "Pet cadastrado!" });
  } catch {
    res.status(500).json({ erro: "Erro ao criar pet." });
  }
});

// Editar pet
router.put("/:id", auth, async (req, res) => {
  const { nome, especie, raca, data_nascimento, emoji } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: "Nome obrigatório." });
  try {
    await db.query(
      "UPDATE Pets SET nome=?, especie=?, raca=?, data_nascimento=?, emoji=? WHERE id=? AND usuario_id=?",
      [nome.trim(), especie || "cachorro", raca || null, data_nascimento || null, emoji || "🐾", req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Pet atualizado!" });
  } catch {
    res.status(500).json({ erro: "Erro ao atualizar pet." });
  }
});

// Deletar pet
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query("DELETE FROM Pets WHERE id=? AND usuario_id=?", [req.params.id, req.usuarioId]);
    res.json({ mensagem: "Pet removido." });
  } catch {
    res.status(500).json({ erro: "Erro ao remover pet." });
  }
});

module.exports = router;
