const db = require("../config/db");
const { enviarPushUsuario } = require("./push");

// Roda a verificação e dispara as notificações push diárias
async function rodarPushDiario() {
  try {
    const hoje = new Date();
    const hojeSt = hoje.toISOString().split("T")[0];
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toISOString().split("T")[0];
    const em3Dias = new Date(hoje);
    em3Dias.setDate(em3Dias.getDate() + 3);
    const em3Str = em3Dias.toISOString().split("T")[0];

    // ── 1. Recorrentes com próxima data = hoje ou amanhã ──
    const [recorrentes] = await db.query(
      `SELECT r.usuario_id, r.descricao, r.proxima_data, r.tipo
       FROM Recorrentes r
       WHERE r.ativo = 1 AND r.proxima_data IN (?, ?)`,
      [hojeSt, amanhaStr],
    );
    for (const r of recorrentes) {
      const quando = r.proxima_data === hojeSt ? "hoje" : "amanhã";
      await enviarPushUsuario(
        r.usuario_id,
        `${r.tipo === "receita" ? "💰" : "📅"} Lançamento recorrente`,
        `"${r.descricao}" vence ${quando}.`,
        "/lancamentos.html?aba=recorrentes",
      );
    }

    // ── 2. Faturas de cartão vencendo em até 3 dias ──
    const [faturas] = await db.query(
      `SELECT f.usuario_id, c.nome AS conta_nome, f.data_vencimento, f.total
       FROM FaturasCartao f
       JOIN Contas c ON c.id = f.conta_id
       WHERE f.data_vencimento BETWEEN ? AND ? AND f.paga = 0`,
      [hojeSt, em3Str],
    );
    for (const f of faturas) {
      const diasFaltam = Math.round((new Date(f.data_vencimento) - hoje) / 86400000);
      const quando = diasFaltam === 0 ? "hoje" : diasFaltam === 1 ? "amanhã" : `em ${diasFaltam} dias`;
      const valor = parseFloat(f.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      await enviarPushUsuario(
        f.usuario_id,
        "💳 Fatura vencendo",
        `Fatura de ${f.conta_nome} (${valor}) vence ${quando}.`,
        "/contas.html",
      );
    }

    // ── 3. Metas de economia atingidas ──
    const [metas] = await db.query(
      `SELECT m.id, m.usuario_id, m.nome, m.valor_meta, m.valor_atual
       FROM Metas m
       WHERE m.valor_atual >= m.valor_meta AND m.notificado_atingida = 0`,
    );
    for (const meta of metas) {
      await enviarPushUsuario(
        meta.usuario_id,
        "🎯 Meta atingida!",
        `Você atingiu a meta "${meta.nome}". Parabéns!`,
        "/relatorios.html?aba=metas",
      );
      await db.query("UPDATE Metas SET notificado_atingida = 1 WHERE id = ?", [meta.id]);
    }

    console.log(`[Push diário] ${recorrentes.length} recorrentes, ${faturas.length} faturas, ${metas.length} metas`);
  } catch (err) {
    console.error("[Push diário] Erro:", err.message);
  }
}

// Agenda para rodar às 8h todos os dias
function iniciarCronPush() {
  const agora = new Date();
  const proximas8h = new Date(agora);
  proximas8h.setHours(8, 0, 0, 0);
  if (proximas8h <= agora) proximas8h.setDate(proximas8h.getDate() + 1);

  const msAte8h = proximas8h - agora;
  setTimeout(() => {
    rodarPushDiario();
    setInterval(rodarPushDiario, 24 * 60 * 60 * 1000);
  }, msAte8h);

  console.log(`[Push cron] Próxima execução em ${Math.round(msAte8h / 60000)} min`);
}

module.exports = { iniciarCronPush, rodarPushDiario };
