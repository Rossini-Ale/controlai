const TelegramBot = require("node-telegram-bot-api");
const db = require("../config/db");

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { webHook: true });

// Mapa de chat_id → usuario_id (persistido no banco)
async function getUsuario(chatId) {
  const [rows] = await db.query(
    "SELECT * FROM Usuarios WHERE telegram_chat_id = ?",
    [chatId],
  );
  return rows[0] || null;
}

// Busca categorias do usuário
async function getCategorias(usuarioId) {
  const [rows] = await db.query(
    "SELECT * FROM Categorias WHERE usuario_id = ?",
    [usuarioId],
  );
  return rows;
}

// Busca contas do usuário
async function getContas(usuarioId) {
  const [rows] = await db.query("SELECT * FROM Contas WHERE usuario_id = ?", [
    usuarioId,
  ]);
  return rows;
}

// Busca cartões do usuário
async function getCartoes(usuarioId) {
  const [rows] = await db.query("SELECT * FROM Cartoes WHERE usuario_id = ?", [
    usuarioId,
  ]);
  return rows;
}

// Encontra categoria pelo nome (busca parcial)
function encontrarCategoria(categorias, nome) {
  const nomeLower = nome.toLowerCase();
  return categorias.find(
    (c) =>
      c.nome.toLowerCase().includes(nomeLower) ||
      nomeLower.includes(c.nome.toLowerCase()),
  );
}

// Encontra conta pelo nome (busca parcial)
function encontrarConta(contas, nome) {
  const nomeLower = nome.toLowerCase();
  return contas.find(
    (c) =>
      c.nome.toLowerCase().includes(nomeLower) ||
      nomeLower.includes(c.nome.toLowerCase()),
  );
}

// Formatador de moeda
const fmt = (v) =>
  `R$ ${parseFloat(v || 0)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

// Barra de progresso visual
function barProgresso(pct) {
  const total = 10;
  const preenchido = Math.round((Math.min(pct, 100) / 100) * total);
  const vazio = total - preenchido;
  const emoji = pct >= 100 ? "🔴" : pct >= 80 ? "🟡" : "🟢";
  return `${emoji} [${"█".repeat(preenchido)}${"░".repeat(vazio)}] ${pct.toFixed(0)}%`;
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

// Parser de mensagem
function parsearMensagem(texto) {
  const regex =
    /^(despesa|receita|gasto|entrada|cartao|cartão)\s+([\d.,]+)\s+(.+?)(?:\s+([\d]+)x)?$/i;
  const match = texto.match(regex);
  if (!match) return null;
  let [, tipo, valorStr, resto, parcelas] = match;
  const valor = parseFloat(valorStr.replace(",", "."));
  if (isNaN(valor) || valor <= 0) return null;
  if (["gasto", "despesa"].includes(tipo.toLowerCase())) tipo = "despesa";
  if (["entrada", "receita"].includes(tipo.toLowerCase())) tipo = "receita";
  if (["cartao", "cartão"].includes(tipo.toLowerCase())) tipo = "cartao";
  const partes = resto.trim().split(/\s+/);
  const categoria = partes[partes.length - 1];
  const descricao = partes.slice(0, -1).join(" ") || partes[0];
  return {
    tipo,
    valor,
    descricao: descricao.charAt(0).toUpperCase() + descricao.slice(1),
    categoriaNome: categoria,
    parcelas: parcelas ? parseInt(parcelas) : 1,
  };
}

// Mensagem de ajuda
const AJUDA = `
🤖 *Controlaí Bot*

*Como lançar:*
\`despesa 45.00 Almoço alimentação\`
\`receita 5000 Salário salario\`
\`cartao 1200 iPhone eletrônicos 10x\`

*Consultas:*
/saldo — Ver saldo do mês
/orcamento — Orçamento e limites do mês
/recorrentes — Suas transações recorrentes
/resumosemanal — Resumo dos últimos 7 dias
/categorias — Listar categorias
/contas — Listar contas

*Conta:*
/conectar SEU_USERNAME
/ajuda — Ver esta mensagem
`;

// ── Comandos ──

bot.onText(/\/start/, async (msg) => {
  bot.sendMessage(msg.chat.id, AJUDA, { parse_mode: "Markdown" });
});

bot.onText(/\/ajuda/, async (msg) => {
  bot.sendMessage(msg.chat.id, AJUDA, { parse_mode: "Markdown" });
});

bot.onText(/\/conectar (.+)/, async (msg, match) => {
  const username = match[1].trim();
  const chatId = msg.chat.id;
  try {
    const [rows] = await db.query("SELECT * FROM Usuarios WHERE username = ?", [
      username,
    ]);
    if (rows.length === 0) {
      bot.sendMessage(
        chatId,
        "❌ Usuário não encontrado. Verifique seu username no controlaí.",
      );
      return;
    }
    await db.query(
      "UPDATE Usuarios SET telegram_chat_id = ? WHERE username = ?",
      [chatId, username],
    );
    bot.sendMessage(
      chatId,
      `✅ Conta *${rows[0].nome}* conectada com sucesso!\n\nAgora você pode lançar gastos por aqui. Digite /ajuda para ver como.`,
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    bot.sendMessage(chatId, "❌ Erro ao conectar conta.");
  }
});

bot.onText(/\/saldo/, async (msg) => {
  const chatId = msg.chat.id;
  const usuario = await getUsuario(chatId);
  if (!usuario) {
    bot.sendMessage(
      chatId,
      "❌ Conta não conectada. Use /conectar SEU_USERNAME",
    );
    return;
  }
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();
  const [[resumo]] = await db.query(
    `SELECT
       SUM(CASE WHEN tipo='receita' AND IFNULL(is_transferencia,0)=0 THEN valor ELSE 0 END) as receitas,
       SUM(CASE WHEN tipo='despesa' AND IFNULL(is_transferencia,0)=0 THEN valor ELSE 0 END) as despesas,
       SUM(CASE WHEN tipo='receita' AND IFNULL(is_transferencia,0)=0 THEN valor
                WHEN tipo='despesa' AND IFNULL(is_transferencia,0)=0 THEN -valor
                ELSE 0 END) as saldo
     FROM Transacoes
     WHERE usuario_id=? AND MONTH(data)=? AND YEAR(data)=?`,
    [usuario.id, mes, ano],
  );
  bot.sendMessage(
    chatId,
    `📊 *Resumo de ${MESES[mes - 1]}*\n\n` +
      `✅ Receitas: *${fmt(resumo.receitas)}*\n` +
      `❌ Despesas: *${fmt(resumo.despesas)}*\n` +
      `💰 Saldo: *${fmt(resumo.saldo)}*`,
    { parse_mode: "Markdown" },
  );
});

// ── NOVO: /orcamento ──
bot.onText(/\/orcamento/, async (msg) => {
  const chatId = msg.chat.id;
  const usuario = await getUsuario(chatId);
  if (!usuario) {
    bot.sendMessage(
      chatId,
      "❌ Conta não conectada. Use /conectar SEU_USERNAME",
    );
    return;
  }
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();
  try {
    const [orcamentos] = await db.query(
      `SELECT o.*, c.nome AS categoria_nome,
              COALESCE((
                SELECT SUM(t.valor) FROM Transacoes t
                WHERE t.usuario_id = o.usuario_id AND t.tipo = 'despesa'
                  AND IFNULL(t.is_transferencia,0) = 0
                  AND (o.categoria_id IS NULL OR t.categoria_id = o.categoria_id)
                  AND MONTH(t.data) = o.mes AND YEAR(t.data) = o.ano
              ), 0) AS gasto_atual
       FROM Orcamentos o
       LEFT JOIN Categorias c ON o.categoria_id = c.id
       WHERE o.usuario_id = ? AND o.mes = ? AND o.ano = ?
       ORDER BY (o.categoria_id IS NULL) DESC, c.nome ASC`,
      [usuario.id, mes, ano],
    );

    if (orcamentos.length === 0) {
      bot.sendMessage(
        chatId,
        `📋 *Orçamento de ${MESES[mes - 1]}*\n\nNenhum limite definido ainda.\n\nAcesse *Configurações → Orçamento* no app para definir seus limites.`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    let mensagem = `📋 *Orçamento de ${MESES[mes - 1]}*\n\n`;

    const geral = orcamentos.find((o) => !o.categoria_id);
    if (geral) {
      const gasto = parseFloat(geral.gasto_atual) || 0;
      const limite = parseFloat(geral.limite) || 0;
      const pct = limite > 0 ? (gasto / limite) * 100 : 0;
      mensagem += `💼 *Orçamento geral*\n`;
      mensagem += `${barProgresso(pct)}\n`;
      mensagem += `Gasto: *${fmt(gasto)}* / Limite: *${fmt(limite)}*\n`;
      mensagem += `Restante: *${fmt(Math.max(limite - gasto, 0))}*\n\n`;
    }

    const porCategoria = orcamentos.filter((o) => o.categoria_id);
    if (porCategoria.length > 0) {
      mensagem += `📂 *Por categoria:*\n\n`;
      for (const o of porCategoria) {
        const gasto = parseFloat(o.gasto_atual) || 0;
        const limite = parseFloat(o.limite) || 0;
        const pct = limite > 0 ? (gasto / limite) * 100 : 0;
        mensagem += `*${o.categoria_nome}*\n`;
        mensagem += `${barProgresso(pct)}\n`;
        mensagem += `${fmt(gasto)} / ${fmt(limite)}\n\n`;
      }
    }

    bot.sendMessage(chatId, mensagem, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[Telegram /orcamento]", err.message);
    bot.sendMessage(chatId, "❌ Erro ao buscar orçamento.");
  }
});

// ── NOVO: /recorrentes ──
bot.onText(/\/recorrentes/, async (msg) => {
  const chatId = msg.chat.id;
  const usuario = await getUsuario(chatId);
  if (!usuario) {
    bot.sendMessage(
      chatId,
      "❌ Conta não conectada. Use /conectar SEU_USERNAME",
    );
    return;
  }
  try {
    const [rows] = await db.query(
      `SELECT r.*, c.nome AS categoria_nome
       FROM TransacoesRecorrentes r
       LEFT JOIN Categorias c ON r.categoria_id = c.id
       WHERE r.usuario_id = ? AND r.ativa = 1
       ORDER BY r.proxima_geracao ASC
       LIMIT 10`,
      [usuario.id],
    );

    if (rows.length === 0) {
      bot.sendMessage(
        chatId,
        "📋 Nenhuma transação recorrente ativa.\n\nAcesse *Lançamentos → Recorrentes* no app para criar.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const FREQ = {
      diaria: "Diária",
      semanal: "Semanal",
      quinzenal: "Quinzenal",
      mensal: "Mensal",
      bimestral: "Bimestral",
      trimestral: "Trimestral",
      semestral: "Semestral",
      anual: "Anual",
    };

    let mensagem = `🔄 *Suas recorrências ativas*\n\n`;
    for (const r of rows) {
      const sinal = r.tipo === "receita" ? "✅" : "❌";
      const proxima = r.proxima_geracao
        ? new Date(r.proxima_geracao).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
          })
        : "—";
      mensagem += `${sinal} *${r.descricao}*\n`;
      mensagem += `${fmt(r.valor)} · ${FREQ[r.frequencia] || r.frequencia}\n`;
      mensagem += `Próxima: ${proxima}\n\n`;
    }

    bot.sendMessage(chatId, mensagem, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[Telegram /recorrentes]", err.message);
    bot.sendMessage(chatId, "❌ Erro ao buscar recorrências.");
  }
});

// ── NOVO: /resumosemanal ──
bot.onText(/\/resumosemanal/, async (msg) => {
  const chatId = msg.chat.id;
  const usuario = await getUsuario(chatId);
  if (!usuario) {
    bot.sendMessage(
      chatId,
      "❌ Conta não conectada. Use /conectar SEU_USERNAME",
    );
    return;
  }

  const agora = new Date();
  const mes = agora.getMonth() + 1;
  const ano = agora.getFullYear();
  const seteDiasAtras = new Date(agora.getTime() - 7 * 86400000);
  const dataInicio = seteDiasAtras.toISOString().split("T")[0];
  const dataFim = agora.toISOString().split("T")[0];

  try {
    const [categorias] = await db.query(
      `SELECT c.nome, SUM(t.valor) AS total
       FROM Transacoes t
       LEFT JOIN Categorias c ON t.categoria_id = c.id
       WHERE t.usuario_id = ? AND t.tipo = 'despesa'
         AND IFNULL(t.is_transferencia, 0) = 0
         AND t.data BETWEEN ? AND ?
       GROUP BY t.categoria_id, c.nome
       ORDER BY total DESC LIMIT 5`,
      [usuario.id, dataInicio, dataFim],
    );

    const [[totais]] = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo='receita' AND IFNULL(is_transferencia,0)=0 THEN valor ELSE 0 END), 0) AS receitas,
         COALESCE(SUM(CASE WHEN tipo='despesa' AND IFNULL(is_transferencia,0)=0 THEN valor ELSE 0 END), 0) AS despesas
       FROM Transacoes
       WHERE usuario_id = ? AND data BETWEEN ? AND ?`,
      [usuario.id, dataInicio, dataFim],
    );

    const [[mesTotais]] = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN tipo='despesa' AND IFNULL(is_transferencia,0)=0 THEN valor ELSE 0 END), 0) AS despesas_mes
       FROM Transacoes WHERE usuario_id = ? AND MONTH(data) = ? AND YEAR(data) = ?`,
      [usuario.id, mes, ano],
    );

    const receitas = parseFloat(totais.receitas) || 0;
    const despesas = parseFloat(totais.despesas) || 0;
    const despesasMes = parseFloat(mesTotais.despesas_mes) || 0;

    let mensagem = `📊 *Resumo dos últimos 7 dias*\n`;
    mensagem += `_${seteDiasAtras.toLocaleDateString("pt-BR")} a ${agora.toLocaleDateString("pt-BR")}_\n\n`;
    mensagem += `✅ Receitas: *${fmt(receitas)}*\n`;
    mensagem += `❌ Despesas: *${fmt(despesas)}*\n`;
    mensagem += `💰 Saldo: *${fmt(receitas - despesas)}*\n\n`;

    if (categorias.length > 0) {
      mensagem += `📂 *Top gastos por categoria:*\n`;
      for (const c of categorias) {
        mensagem += `• ${c.nome || "Sem categoria"}: *${fmt(c.total)}*\n`;
      }
      mensagem += `\n`;
    }

    mensagem += `📅 Total gasto em ${MESES[mes - 1]}: *${fmt(despesasMes)}*`;

    bot.sendMessage(chatId, mensagem, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[Telegram /resumosemanal]", err.message);
    bot.sendMessage(chatId, "❌ Erro ao gerar resumo.");
  }
});

bot.onText(/\/categorias/, async (msg) => {
  const chatId = msg.chat.id;
  const usuario = await getUsuario(chatId);
  if (!usuario) {
    bot.sendMessage(
      chatId,
      "❌ Conta não conectada. Use /conectar SEU_USERNAME",
    );
    return;
  }
  const categorias = await getCategorias(usuario.id);
  if (categorias.length === 0) {
    bot.sendMessage(chatId, "❌ Nenhuma categoria cadastrada.");
    return;
  }
  const despesas = categorias
    .filter((c) => c.tipo === "despesa")
    .map((c) => `• ${c.nome}`)
    .join("\n");
  const receitas = categorias
    .filter((c) => c.tipo === "receita")
    .map((c) => `• ${c.nome}`)
    .join("\n");
  bot.sendMessage(
    chatId,
    `📂 *Suas categorias:*\n\n*Despesas:*\n${despesas || "—"}\n\n*Receitas:*\n${receitas || "—"}`,
    { parse_mode: "Markdown" },
  );
});

bot.onText(/\/contas/, async (msg) => {
  const chatId = msg.chat.id;
  const usuario = await getUsuario(chatId);
  if (!usuario) {
    bot.sendMessage(
      chatId,
      "❌ Conta não conectada. Use /conectar SEU_USERNAME",
    );
    return;
  }
  const contas = await getContas(usuario.id);
  if (contas.length === 0) {
    bot.sendMessage(chatId, "❌ Nenhuma conta cadastrada.");
    return;
  }
  const lista = contas.map((c) => `• ${c.nome} (${c.tipo})`).join("\n");
  bot.sendMessage(chatId, `🏦 *Suas contas:*\n\n${lista}`, {
    parse_mode: "Markdown",
  });
});

// ── Lançamentos via mensagem ──
bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return;
  const chatId = msg.chat.id;
  const usuario = await getUsuario(chatId);

  if (!usuario) {
    bot.sendMessage(
      chatId,
      "❌ Conta não conectada. Use:\n/conectar SEU_USERNAME",
    );
    return;
  }

  const parsed = parsearMensagem(msg.text || "");
  if (!parsed) {
    bot.sendMessage(
      chatId,
      "❓ Não entendi. Use o formato:\n\n" +
        "`despesa 45.00 Almoço alimentação`\n" +
        "`receita 5000 Salário salario`\n" +
        "`cartao 1200 iPhone eletrônicos 10x`\n\n" +
        "Digite /ajuda para mais detalhes.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  const categorias = await getCategorias(usuario.id);
  const contas = await getContas(usuario.id);
  const cartoes = await getCartoes(usuario.id);
  const hoje = new Date().toISOString().split("T")[0];

  try {
    if (parsed.tipo === "cartao") {
      if (cartoes.length === 0) {
        bot.sendMessage(chatId, "❌ Nenhum cartão cadastrado no controlaí.");
        return;
      }
      const cartao = cartoes[0];
      const categoria = encontrarCategoria(
        categorias.filter((c) => c.tipo === "despesa"),
        parsed.categoriaNome,
      );
      const agora = new Date();
      const valorParcela = parseFloat(
        (parsed.valor / parsed.parcelas).toFixed(2),
      );
      const parcela_ref = Date.now().toString();

      for (let i = 0; i < parsed.parcelas; i++) {
        const d = new Date(agora);
        d.setMonth(d.getMonth() + i);
        const mP = d.getMonth() + 1;
        const aP = d.getFullYear();
        const [faturaRows] = await db.query(
          "SELECT * FROM FaturasCartao WHERE cartao_id=? AND mes=? AND ano=?",
          [cartao.id, mP, aP],
        );
        let faturaId;
        if (faturaRows.length > 0) {
          faturaId = faturaRows[0].id;
        } else {
          const [res] = await db.query(
            "INSERT INTO FaturasCartao (cartao_id, usuario_id, mes, ano) VALUES (?,?,?,?)",
            [cartao.id, usuario.id, mP, aP],
          );
          faturaId = res.insertId;
        }
        const desc =
          parsed.parcelas > 1
            ? `${parsed.descricao} (${i + 1}/${parsed.parcelas})`
            : parsed.descricao;
        const dataFmt = `${aP}-${String(mP).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        await db.query(
          `INSERT INTO Transacoes (usuario_id, cartao_id, fatura_id, categoria_id, tipo, descricao, valor, data, parcelas, parcela_atual, parcela_ref)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            usuario.id,
            cartao.id,
            faturaId,
            categoria?.id || null,
            "despesa",
            desc,
            valorParcela,
            dataFmt,
            parsed.parcelas,
            i + 1,
            parcela_ref,
          ],
        );
      }

      const resposta =
        parsed.parcelas > 1
          ? `💳 *${parsed.descricao}* lançado em ${parsed.parcelas}x de ${fmt(parsed.valor / parsed.parcelas)} no cartão *${cartao.nome}*`
          : `💳 *${parsed.descricao}* lançado no cartão *${cartao.nome}*\nValor: *${fmt(parsed.valor)}*`;
      bot.sendMessage(
        chatId,
        resposta + (categoria ? `\nCategoria: ${categoria.nome}` : ""),
        { parse_mode: "Markdown" },
      );
    } else {
      const tipoCategoria = parsed.tipo === "receita" ? "receita" : "despesa";
      const categoria = encontrarCategoria(
        categorias.filter((c) => c.tipo === tipoCategoria),
        parsed.categoriaNome,
      );
      const conta = contas.length > 0 ? contas[0] : null;

      await db.query(
        `INSERT INTO Transacoes (usuario_id, conta_id, categoria_id, tipo, descricao, valor, data)
         VALUES (?,?,?,?,?,?,?)`,
        [
          usuario.id,
          conta?.id || null,
          categoria?.id || null,
          parsed.tipo,
          parsed.descricao,
          parsed.valor,
          hoje,
        ],
      );

      const emoji = parsed.tipo === "receita" ? "✅" : "❌";
      bot.sendMessage(
        chatId,
        `${emoji} *${parsed.descricao}* lançado!\n` +
          `Valor: *${fmt(parsed.valor)}*\n` +
          `Categoria: ${categoria ? categoria.nome : "(sem categoria)"}\n` +
          `Conta: ${conta ? conta.nome : "(sem conta)"}`,
        { parse_mode: "Markdown" },
      );
    }
  } catch (err) {
    console.error("Telegram bot erro:", err);
    bot.sendMessage(chatId, "❌ Erro ao lançar. Tente novamente.");
  }
});

console.log("🤖 Bot do Telegram iniciado!");
module.exports = bot;
