const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// Listar eventos (opcionalmente filtrado por pet_id)
router.get("/", auth, async (req, res) => {
  try {
    let sql = `SELECT e.*, p.nome AS pet_nome, p.emoji AS pet_emoji
               FROM PetEventos e JOIN Pets p ON p.id = e.pet_id
               WHERE e.usuario_id = ?`;
    const params = [req.usuarioId];
    if (req.query.pet_id) {
      sql += " AND e.pet_id = ?";
      params.push(req.query.pet_id);
    }
    sql += " ORDER BY e.data DESC";
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch {
    res.status(500).json({ erro: "Erro ao buscar eventos." });
  }
});

// Criar evento
router.post("/", auth, async (req, res) => {
  const { pet_id, tipo, descricao, data, proxima_data, custo, observacao } = req.body;
  if (!pet_id || !descricao?.trim() || !data) {
    return res.status(400).json({ erro: "pet_id, descricao e data são obrigatórios." });
  }
  try {
    const [[pet]] = await db.query(
      "SELECT id FROM Pets WHERE id=? AND usuario_id=?",
      [pet_id, req.usuarioId],
    );
    if (!pet) return res.status(404).json({ erro: "Pet não encontrado." });

    const [result] = await db.query(
      "INSERT INTO PetEventos (pet_id, usuario_id, tipo, descricao, data, proxima_data, custo, observacao) VALUES (?,?,?,?,?,?,?,?)",
      [pet_id, req.usuarioId, tipo || "outro", descricao.trim(), data, proxima_data || null, custo || 0, observacao || null],
    );
    res.status(201).json({ id: result.insertId, mensagem: "Evento registrado!" });
  } catch {
    res.status(500).json({ erro: "Erro ao criar evento." });
  }
});

// Editar evento
router.put("/:id", auth, async (req, res) => {
  const { tipo, descricao, data, proxima_data, custo, observacao } = req.body;
  if (!descricao?.trim() || !data) {
    return res.status(400).json({ erro: "descricao e data são obrigatórios." });
  }
  try {
    await db.query(
      `UPDATE PetEventos SET tipo=?, descricao=?, data=?, proxima_data=?, custo=?, observacao=?
       WHERE id=? AND usuario_id=?`,
      [tipo || "outro", descricao.trim(), data, proxima_data || null, custo || 0, observacao || null, req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Evento atualizado!" });
  } catch {
    res.status(500).json({ erro: "Erro ao atualizar evento." });
  }
});

// Deletar evento
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM PetEventos WHERE id=? AND usuario_id=?",
      [req.params.id, req.usuarioId],
    );
    res.json({ mensagem: "Evento removido." });
  } catch {
    res.status(500).json({ erro: "Erro ao remover evento." });
  }
});

module.exports = router;
