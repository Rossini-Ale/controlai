const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// GET /api/tags — retorna lista de tags únicas do usuário (para autocomplete)
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT tags FROM Transacoes
       WHERE usuario_id = ? AND tags IS NOT NULL AND tags != '' AND deleted_at IS NULL
       ORDER BY tags`,
      [req.usuarioId],
    );
    // Expande "tag1,tag2" em itens individuais únicos
    const set = new Set();
    rows.forEach((r) => r.tags.split(",").forEach((t) => {
      const tag = t.trim();
      if (tag) set.add(tag);
    }));
    res.json([...set].sort());
  } catch (err) {
    console.error("[Tags GET]", err.message);
    res.status(500).json({ erro: "Erro ao buscar tags." });
  }
});

module.exports = router;
