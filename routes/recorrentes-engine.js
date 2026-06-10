// routes/recorrentes-engine.js
// Motor: processa recorrências + verifica orçamentos + notifica faturas via Telegram

const db = require("../config/db");

// ─────────────────────────────────────────
// HELPERS DE DATA
// ─────────────────────────────────────────
function ajustarDia(date, dia) {
  const ultimoDia = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(dia, ultimoDia));
}

function calcularProximaData(base, frequencia, dia_vencimento) {
  const d = new Date(base);
  switch (frequencia) {
    case "diaria":
      d.setDate(d.getDate() + 1);
      break;
    case "semanal":
      d.setDate(d.getDate() + 7);
      break;
    case "quinzenal":
      d.setDate(d.getDate() + 15);
      break;
    case "mensal":
      d.setMonth(d.getMonth() + 1);
      ajustarDia(d, dia_vencimento);
      break;
    case "bimestral":
      d.setMonth(d.getMonth() + 2);
      ajustarDia(d, dia_vencimento);
      break;
    case "trimestral":
      d.setMonth(d.getMonth() + 3);
      ajustarDia(d, dia_vencimento);
      break;
    case "semestral":
      d.setMonth(d.getMonth() + 6);
      ajustarDia(d, dia_vencimento);
      break;
    case "anual":
      d.setFullYear(d.getFullYear() + 1);
      ajustarDia(d, dia_vencimento);
      break;
  }
  return d;
}

function calcularPrimeiraData(dataInicio, frequencia, dia_vencimento) {
  const d = new Date(dataInicio + "T00:00:00");
  if (
    ["mensal", "bimestral", "trimestral", "semestral", "anual"].includes(
      frequencia,
    )
  ) {
    ajustarDia(d, dia_vencimento);
    if (d < new Date(dataInicio + "T00:00:00")) {
      d.setMonth(d.getMonth() + 1);
      ajustarDia(d, dia_vencimento);
    }
  }
  return d;
}

function toDateStr(date) {
  return date.toISOString().split("T")[0];
}

function fmt(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// ─────────────────────────────────────────
// TELEGRAM
// ─────────────────────────────────────────
async function enviarTelegram(chatId, mensagem) {
  if (!chatId || !process.env.TELEGRAM_TOKEN) return;
  try {
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensagem,
          parse_mode: "Markdown",
        }),
      },
    );
  } catch (err) {
    console.error("[Telegram] Erro:", err.message);
  }
}

// ─────────────────────────────────────────
// RECORRENTES
// ─────────────────────────────────────────
async function processarRecorrentes() {
  const hoje = toDateStr(new Date());
  try {
    const [pendentes] = await db.query(
      `SELECT * FROM TransacoesRecorrentes
       WHERE ativa = 1 AND proxima_geracao <= ?
         AND (data_fim IS NULL OR data_fim >= ?)`,
      [hoje, hoje],
    );
    if (pendentes.length === 0) return;
    console.log(
      `[Recorrentes] Processando ${pendentes.length} recorrência(s)...`,
    );
    for (const rec of pendentes) await gerarTransacao(rec, rec.proxima_geracao);
  } catch (err) {
    console.error("[Recorrentes] Erro:", err.message);
  }
}

async function gerarTransacao(rec, dataGeracao) {
  try {
    await db.query(
      `INSERT INTO Transacoes
         (usuario_id, conta_id, categoria_id, tipo, descricao, valor, data, observacao, recorrente_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.usuario_id,
        rec.conta_id,
        rec.categoria_id,
        rec.tipo,
        rec.descricao,
        rec.valor,
        dataGeracao,
        rec.observacao || null,
        rec.id,
      ],
    );
    const proxima = calcularProximaData(
      new Date(dataGeracao + "T00:00:00"),
      rec.frequencia,
      rec.dia_vencimento,
    );
    const proximaStr = toDateStr(proxima);
    const ativa = rec.data_fim && proximaStr > rec.data_fim ? 0 : 1;
    await db.query(
      `UPDATE TransacoesRecorrentes SET ultima_geracao=?, proxima_geracao=?, ativa=? WHERE id=?`,
      [dataGeracao, proximaStr, ativa, rec.id],
    );
    console.log(
      `[Recorrentes] ✅ "${rec.descricao}" → ${dataGeracao} | próxima: ${proximaStr}`,
    );
  } catch (err) {
    console.error(`[Recorrentes] ❌ "${rec.descricao}":`, err.message);
  }
}

// ─────────────────────────────────────────
// ORÇAMENTOS
// ─────────────────────────────────────────
async function verificarOrcamentos() {
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();
  const mesNome = MESES[mes - 1];

  try {
    const [orcamentos] = await db.query(
      `SELECT o.*, u.telegram_chat_id, c.nome AS categoria_nome,
              COALESCE((
                SELECT SUM(t.valor) FROM Transacoes t
                WHERE t.usuario_id = o.usuario_id AND t.tipo = 'despesa'
                  AND t.is_transferencia = 0
                  AND (o.categoria_id IS NULL OR t.categoria_id = o.categoria_id)
                  AND MONTH(t.data) = o.mes AND YEAR(t.data) = o.ano
              ), 0) AS gasto_atual
       FROM Orcamentos o
       JOIN Usuarios u ON o.usuario_id = u.id
       LEFT JOIN Categorias c ON o.categoria_id = c.id
       WHERE o.mes = ? AND o.ano = ?`,
      [mes, ano],
    );

    for (const orc of orcamentos) {
      if (!orc.telegram_chat_id) continue;
      const gasto = parseFloat(orc.gasto_atual) || 0;
      const limite = parseFloat(orc.limite) || 0;
      if (limite <= 0) continue;
      const pct = (gasto / limite) * 100;
      const label = orc.categoria_nome
        ? `categoria *${orc.categoria_nome}*`
        : `orçamento geral`;

      if (pct >= 100 && !orc.alerta_100_enviado) {
        await enviarTelegram(
          orc.telegram_chat_id,
          `🚨 *Limite ultrapassado!*\n\nVocê ultrapassou o limite da ${label} em *${mesNome}*.\n\n💸 Gasto: *${fmt(gasto)}*\n🎯 Limite: *${fmt(limite)}*\n📊 Uso: *${pct.toFixed(0)}%*`,
        );
        await db.query(
          "UPDATE Orcamentos SET alerta_100_enviado=1 WHERE id=?",
          [orc.id],
        );
        console.log(
          `[Orçamento] 🚨 100% — ${orc.categoria_nome || "Geral"} (uid ${orc.usuario_id})`,
        );
      } else if (pct >= 80 && pct < 100 && !orc.alerta_80_enviado) {
        await enviarTelegram(
          orc.telegram_chat_id,
          `⚠️ *Atenção ao orçamento!*\n\nVocê usou *${pct.toFixed(0)}%* do limite da ${label} em *${mesNome}*.\n\n💸 Gasto: *${fmt(gasto)}*\n🎯 Limite: *${fmt(limite)}*\n💰 Restante: *${fmt(limite - gasto)}*`,
        );
        await db.query("UPDATE Orcamentos SET alerta_80_enviado=1 WHERE id=?", [
          orc.id,
        ]);
        console.log(
          `[Orçamento] ⚠️ 80% — ${orc.categoria_nome || "Geral"} (uid ${orc.usuario_id})`,
        );
      }
    }
  } catch (err) {
    console.error("[Orçamento] Erro:", err.message);
  }
}

// ─────────────────────────────────────────
// FATURAS
// ─────────────────────────────────────────
async function verificarFaturas() {
  const agora = new Date();
  const hoje = toDateStr(agora);
  const em3 = toDateStr(new Date(agora.getTime() + 3 * 86400000));
  const em7 = toDateStr(new Date(agora.getTime() + 7 * 86400000));
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();

  try {
    const [cartoes] = await db.query(
      `SELECT c.*, u.telegram_chat_id,
              COALESCE((
                SELECT SUM(t.valor) FROM Transacoes t
                INNER JOIN FaturasCartao f ON t.fatura_id = f.id
                WHERE t.cartao_id = c.id AND f.mes = ? AND f.ano = ? AND f.status != 'paga'
              ), 0) AS valor_fatura,
              (SELECT f.status FROM FaturasCartao f
               WHERE f.cartao_id = c.id AND f.mes = ? AND f.ano = ? LIMIT 1) AS status_fatura,
              COALESCE((SELECT f.id FROM FaturasCartao f
               WHERE f.cartao_id = c.id AND f.mes = ? AND f.ano = ? LIMIT 1), NULL) AS fatura_id,
              COALESCE((SELECT f.alerta_atraso_enviado FROM FaturasCartao f
               WHERE f.cartao_id = c.id AND f.mes = ? AND f.ano = ? LIMIT 1), 0) AS alerta_atraso_enviado
       FROM Cartoes c
       JOIN Usuarios u ON c.usuario_id = u.id
       WHERE u.telegram_chat_id IS NOT NULL`,
      [mes, ano, mes, ano, mes, ano, mes, ano],
    );

    for (const c of cartoes) {
      if (!c.telegram_chat_id || c.status_fatura === "paga") continue;
      const valor = parseFloat(c.valor_fatura) || 0;
      if (valor <= 0) continue;
      const dataVenc = `${ano}-${String(mes).padStart(2, "0")}-${String(c.dia_vencimento).padStart(2, "0")}`;

      if (dataVenc === em3) {
        await enviarTelegram(
          c.telegram_chat_id,
          `💳 *Fatura vencendo em 3 dias!*\n\nCartão: *${c.nome}*\nVencimento: *dia ${c.dia_vencimento}/${mes}*\nValor: *${fmt(valor)}*\n\nNão esqueça de pagar! 😊`,
        );
        console.log(`[Fatura] 💳 3 dias: ${c.nome}`);
      } else if (dataVenc === em7) {
        await enviarTelegram(
          c.telegram_chat_id,
          `📅 *Lembrete de fatura*\n\nCartão: *${c.nome}*\nVencimento: *dia ${c.dia_vencimento}/${mes}*\nValor: *${fmt(valor)}*\n\nFaltam 7 dias para o vencimento.`,
        );
        console.log(`[Fatura] 📅 7 dias: ${c.nome}`);
      } else if (dataVenc < hoje && !c.alerta_atraso_enviado) {
        await enviarTelegram(
          c.telegram_chat_id,
          `🔴 *Fatura em atraso!*\n\nCartão: *${c.nome}*\nVenceu em: *dia ${c.dia_vencimento}/${mes}*\nValor: *${fmt(valor)}*\n\nRegularize o quanto antes!`,
        );
        if (c.fatura_id) {
          await db.query(
            "UPDATE FaturasCartao SET alerta_atraso_enviado = 1 WHERE id = ?",
            [c.fatura_id],
          );
        }
        console.log(`[Fatura] 🔴 Atraso: ${c.nome}`);
      }
    }
  } catch (err) {
    console.error("[Fatura] Erro:", err.message);
  }
}

// ─────────────────────────────────────────
// RESUMO SEMANAL (toda domingo)
// ─────────────────────────────────────────
async function enviarResumosSemanal() {
  const agora = new Date();
  // Só roda aos domingos
  if (agora.getDay() !== 0) return;

  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();

  // Data de 7 dias atrás
  const seteDiasAtras = new Date(agora.getTime() - 7 * 86400000);
  const dataInicio = toDateStr(seteDiasAtras);
  const dataFim = toDateStr(agora);

  try {
    // Busca todos os usuários com Telegram conectado
    const [usuarios] = await db.query(
      "SELECT id, nome, telegram_chat_id FROM Usuarios WHERE telegram_chat_id IS NOT NULL",
    );

    for (const u of usuarios) {
      // Gastos da semana por categoria
      const [categorias] = await db.query(
        `SELECT c.nome, c.icone, SUM(t.valor) AS total
         FROM Transacoes t
         LEFT JOIN Categorias c ON t.categoria_id = c.id
         WHERE t.usuario_id = ? AND t.tipo = 'despesa'
           AND IFNULL(t.is_transferencia, 0) = 0
           AND t.data BETWEEN ? AND ?
         GROUP BY t.categoria_id, c.nome, c.icone
         ORDER BY total DESC
         LIMIT 5`,
        [u.id, dataInicio, dataFim],
      );

      // Total receitas e despesas da semana
      const [[totais]] = await db.query(
        `SELECT
           COALESCE(SUM(CASE WHEN tipo='receita' AND IFNULL(is_transferencia,0)=0 THEN valor ELSE 0 END), 0) AS receitas,
           COALESCE(SUM(CASE WHEN tipo='despesa' AND IFNULL(is_transferencia,0)=0 THEN valor ELSE 0 END), 0) AS despesas
         FROM Transacoes
         WHERE usuario_id = ? AND data BETWEEN ? AND ?`,
        [u.id, dataInicio, dataFim],
      );

      // Total do mês até hoje
      const [[mes_totais]] = await db.query(
        `SELECT
           COALESCE(SUM(CASE WHEN tipo='despesa' AND IFNULL(is_transferencia,0)=0 THEN valor ELSE 0 END), 0) AS despesas_mes
         FROM Transacoes
         WHERE usuario_id = ? AND MONTH(data) = ? AND YEAR(data) = ?`,
        [u.id, mes, ano],
      );

      const receitas = parseFloat(totais.receitas) || 0;
      const despesas = parseFloat(totais.despesas) || 0;
      const despesasMes = parseFloat(mes_totais.despesas_mes) || 0;
      const saldo = receitas - despesas;

      const dataInicioFmt = seteDiasAtras.toLocaleDateString("pt-BR");
      const dataFimFmt = agora.toLocaleDateString("pt-BR");

      let msg = `📊 *Resumo semanal*\n`;
      msg += `_${dataInicioFmt} a ${dataFimFmt}_\n\n`;
      msg += `✅ Receitas: *${fmt(receitas)}*\n`;
      msg += `❌ Despesas: *${fmt(despesas)}*\n`;
      msg += `💰 Saldo da semana: *${fmt(saldo)}*\n\n`;

      if (categorias.length > 0) {
        msg += `📂 *Top gastos por categoria:*\n`;
        for (const c of categorias) {
          msg += `• ${c.nome || "Sem categoria"}: *${fmt(c.total)}*\n`;
        }
        msg += `\n`;
      }

      msg += `📅 Total gasto em ${MESES[mes - 1]}: *${fmt(despesasMes)}*`;

      await enviarTelegram(u.telegram_chat_id, msg);
      console.log(`[ResumoSemanal] ✅ Enviado para ${u.nome}`);
    }
  } catch (err) {
    console.error("[ResumoSemanal] Erro:", err.message);
  }
}

// ─────────────────────────────────────────
// RUNNER PRINCIPAL
// ─────────────────────────────────────────
async function rodarTudo() {
  console.log(`[Cron] ${new Date().toISOString()} — Iniciando...`);
  await processarRecorrentes();
  await verificarOrcamentos();
  await verificarFaturas();
  await enviarResumosSemanal();
  console.log(`[Cron] Concluído.`);
}

module.exports = {
  rodarTudo,
  processarRecorrentes,
  verificarOrcamentos,
  verificarFaturas,
  enviarResumosSemanal,
  calcularProximaData,
  calcularPrimeiraData,
  toDateStr,
};
