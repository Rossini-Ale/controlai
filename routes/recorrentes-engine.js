// routes/recorrentes-engine.js
// Motor que processa as transações recorrentes e gera as transações reais
// Chamado pelo server.js via setInterval (a cada hora)

const db = require("../config/db");

/**
 * Calcula a próxima data de geração baseada na frequência.
 * @param {Date} base - Data base (última geração ou data_inicio)
 * @param {string} frequencia
 * @param {number} dia_vencimento
 * @returns {Date}
 */
function calcularProximaData(base, frequencia, dia_vencimento) {
  const d = new Date(base);

  switch (frequencia) {
    case "diaria":
      d.setDate(d.getDate() + 1);
      break;

    case "semanal":
      // dia_vencimento = 0 (Dom) ... 6 (Sáb)
      d.setDate(d.getDate() + 7);
      break;

    case "quinzenal":
      d.setDate(d.getDate() + 15);
      break;

    case "mensal":
      d.setMonth(d.getMonth() + 1);
      // Ajusta para o dia correto (ex: 31 em fevereiro)
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

/**
 * Ajusta o dia do mês, respeitando o último dia do mês.
 */
function ajustarDia(date, dia) {
  const ultimoDia = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(dia, ultimoDia));
}

/**
 * Calcula a primeira data de geração a partir da data_inicio.
 */
function calcularPrimeiraData(dataInicio, frequencia, dia_vencimento) {
  const d = new Date(dataInicio + "T00:00:00");

  // Para frequências mensais+, define o dia correto no mês da data_inicio
  if (
    ["mensal", "bimestral", "trimestral", "semestral", "anual"].includes(
      frequencia,
    )
  ) {
    ajustarDia(d, dia_vencimento);
    // Se o dia ajustado ficou antes da data_inicio, avança um período
    if (d < new Date(dataInicio + "T00:00:00")) {
      d.setMonth(d.getMonth() + 1);
      ajustarDia(d, dia_vencimento);
    }
  }

  return d;
}

/**
 * Formata uma Date para string YYYY-MM-DD
 */
function toDateStr(date) {
  return date.toISOString().split("T")[0];
}

/**
 * Processa TODAS as recorrências pendentes (proxima_geracao <= hoje).
 * Chamado periodicamente pelo server.js.
 */
async function processarRecorrentes() {
  const hoje = toDateStr(new Date());

  try {
    // Busca todas as recorrências ativas com proxima_geracao vencida
    const [pendentes] = await db.query(
      `SELECT * FROM TransacoesRecorrentes
       WHERE ativa = 1
         AND proxima_geracao <= ?
         AND (data_fim IS NULL OR data_fim >= ?)`,
      [hoje, hoje],
    );

    if (pendentes.length === 0) return;

    console.log(
      `[Recorrentes] Processando ${pendentes.length} recorrência(s)...`,
    );

    for (const rec of pendentes) {
      await gerarTransacao(rec, rec.proxima_geracao);
    }

    console.log(`[Recorrentes] Processamento concluído.`);
  } catch (err) {
    console.error("[Recorrentes] Erro ao processar:", err.message);
  }
}

/**
 * Gera a transação real e avança a proxima_geracao.
 */
async function gerarTransacao(rec, dataGeracao) {
  try {
    // Insere a transação real
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

    // Calcula a próxima data
    const baseDate = new Date(dataGeracao + "T00:00:00");
    const proxima = calcularProximaData(
      baseDate,
      rec.frequencia,
      rec.dia_vencimento,
    );
    const proximaStr = toDateStr(proxima);

    // Verifica se a próxima data já ultrapassou data_fim
    let ativa = 1;
    if (rec.data_fim && proximaStr > rec.data_fim) {
      ativa = 0; // Desativa ao chegar no fim
    }

    // Atualiza ultima_geracao e proxima_geracao
    await db.query(
      `UPDATE TransacoesRecorrentes
       SET ultima_geracao = ?, proxima_geracao = ?, ativa = ?
       WHERE id = ?`,
      [dataGeracao, proximaStr, ativa, rec.id],
    );

    console.log(
      `[Recorrentes] ✅ "${rec.descricao}" gerada para ${dataGeracao} → próxima: ${proximaStr}`,
    );
  } catch (err) {
    console.error(
      `[Recorrentes] ❌ Erro ao gerar "${rec.descricao}":`,
      err.message,
    );
  }
}

module.exports = {
  processarRecorrentes,
  calcularProximaData,
  calcularPrimeiraData,
  toDateStr,
};
