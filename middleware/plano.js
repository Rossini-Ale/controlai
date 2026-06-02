const db = require("../config/db");

async function verificarLimiteTransacoes(req, res, next) {
  try {
    const [[u]] = await db.query(
      "SELECT plano FROM Usuarios WHERE id=?",
      [req.usuarioId],
    );
    if ((u?.plano || "free") === "pro") return next();

    const mes = new Date().getMonth() + 1;
    const ano = new Date().getFullYear();
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM Transacoes
       WHERE usuario_id=? AND MONTH(data)=? AND YEAR(data)=? AND deleted_at IS NULL`,
      [req.usuarioId, mes, ano],
    );

    if (total >= 30) {
      return res.status(403).json({
        erro: "Limite do plano gratuito atingido (30 transações/mês).",
        upgrade: true,
      });
    }
    next();
  } catch {
    next();
  }
}

module.exports = { verificarLimiteTransacoes };
