// Fluxo de caixa projetado — próximos N dias
const { calcularProximaData, toDateStr } = require("./recorrentes-engine");

router.get("/fluxo", auth, async (req, res) => {
  const dias = Math.min(parseInt(req.query.dias) || 30, 90);
  try {
    // Saldo atual de todas as contas
    const [[saldoRow]] = await db.query(
      `SELECT SUM(c.saldo_inicial +
         COALESCE((
           SELECT SUM(CASE WHEN t.tipo='receita' THEN t.valor ELSE -t.valor END)
           FROM Transacoes t WHERE t.conta_id = c.id AND t.deleted_at IS NULL
         ), 0)
       ) AS saldo_total
       FROM Contas c WHERE c.usuario_id = ?`,
      [req.usuarioId],
    );
    const saldoInicial = parseFloat(saldoRow?.saldo_total) || 0;

    // Recorrentes ativas
    const [recorrentes] = await db.query(
      `SELECT * FROM TransacoesRecorrentes
       WHERE usuario_id = ? AND ativa = 1
         AND (data_fim IS NULL OR data_fim >= CURDATE())`,
      [req.usuarioId],
    );

    // Transações já lançadas nos próximos dias (agendadas)
    const hoje = new Date();
    const fimDate = new Date(hoje.getTime() + dias * 86400000);
    const fimStr = toDateStr(fimDate);
    const hojeStr = toDateStr(hoje);

    const [lancadas] = await db.query(
      `SELECT data, tipo, valor, descricao FROM Transacoes
       WHERE usuario_id = ? AND deleted_at IS NULL
         AND data > ? AND data <= ?`,
      [req.usuarioId, hojeStr, fimStr],
    );

    // Monta mapa dia → eventos
    const eventos = {}; // { "2026-05-25": [{ descricao, valor, tipo }] }

    lancadas.forEach((t) => {
      const d = t.data.toISOString?.().split("T")[0] || t.data;
      if (!eventos[d]) eventos[d] = [];
      eventos[d].push({
        descricao: t.descricao,
        valor: parseFloat(t.valor),
        tipo: t.tipo,
      });
    });

    // Projeta recorrentes
    for (const rec of recorrentes) {
      let proxima = new Date(rec.proxima_geracao + "T00:00:00");
      let safeGuard = 0;
      while (toDateStr(proxima) <= fimStr && safeGuard < 200) {
        safeGuard++;
        const dStr = toDateStr(proxima);
        if (dStr > hojeStr) {
          if (!eventos[dStr]) eventos[dStr] = [];
          eventos[dStr].push({
            descricao: rec.descricao,
            valor: parseFloat(rec.valor),
            tipo: rec.tipo,
            recorrente: true,
          });
        }
        proxima = calcularProximaData(
          proxima,
          rec.frequencia,
          rec.dia_vencimento,
        );
      }
    }

    // Gera linha do tempo dia a dia
    const timeline = [];
    let saldoAcumulado = saldoInicial;

    for (let i = 1; i <= dias; i++) {
      const d = new Date(hoje.getTime() + i * 86400000);
      const dStr = toDateStr(d);
      const evts = eventos[dStr] || [];

      let entradas = 0,
        saidas = 0;
      evts.forEach((e) => {
        if (e.tipo === "receita") entradas += e.valor;
        else saidas += e.valor;
      });

      saldoAcumulado += entradas - saidas;
      timeline.push({
        data: dStr,
        entradas,
        saidas,
        saldo: saldoAcumulado,
        eventos: evts,
      });
    }

    res.json({ saldo_inicial: saldoInicial, timeline });
  } catch (err) {
    console.error("[Fluxo]", err.message);
    res.status(500).json({ erro: "Erro ao calcular fluxo de caixa." });
  }
});
