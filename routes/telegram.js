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

// Parser de mensagem
function parsearMensagem(texto) {
  const texto_limpo = texto.trim().toLowerCase();

  // Formato: despesa 45.00 Almoço alimentação
  // Formato: receita 5000 Salário salario
  // Formato: cartao 1200 iPhone eletrônicos 10x
  const regex =
    /^(despesa|receita|gasto|entrada|cartao|cartão)\s+([\d.,]+)\s+(.+?)(?:\s+([\d]+)x)?$/i;
  const match = texto.match(regex);

  if (!match) return null;

  let [, tipo, valorStr, resto, parcelas] = match;
  const valor = parseFloat(valorStr.replace(",", "."));

  if (isNaN(valor) || valor <= 0) return null;

  // Normaliza tipo
  if (["gasto", "despesa"].includes(tipo.toLowerCase())) tipo = "despesa";
  if (["entrada", "receita"].includes(tipo.toLowerCase())) tipo = "receita";
  if (["cartao", "cartão"].includes(tipo.toLowerCase())) tipo = "cartao";

  // Separa descrição e categoria (última palavra é a categoria)
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

*Outros comandos:*
/saldo — Ver saldo do mês
/categorias — Listar categorias
/contas — Listar contas
/ajuda — Ver esta mensagem

*Conectar conta:*
/conectar SEU_USERNAME
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
      SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END) as receitas,
      SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END) as despesas,
      SUM(CASE WHEN tipo='receita' THEN valor ELSE -valor END) as saldo
     FROM Transacoes
     WHERE usuario_id=? AND MONTH(data)=? AND YEAR(data)=?`,
    [usuario.id, mes, ano],
  );
  const fmt = (v) =>
    `R$ ${parseFloat(v || 0)
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  bot.sendMessage(
    chatId,
    `📊 *Resumo de ${agora.toLocaleString("pt-BR", { month: "long" })}*\n\n` +
      `✅ Receitas: *${fmt(resumo.receitas)}*\n` +
      `❌ Despesas: *${fmt(resumo.despesas)}*\n` +
      `💰 Saldo: *${fmt(resumo.saldo)}*`,
    { parse_mode: "Markdown" },
  );
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
  const fmt = (v) =>
    `R$ ${parseFloat(v)
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  try {
    if (parsed.tipo === "cartao") {
      // Lança no cartão
      if (cartoes.length === 0) {
        bot.sendMessage(chatId, "❌ Nenhum cartão cadastrado no controlaí.");
        return;
      }
      const cartao = cartoes[0]; // usa o primeiro cartão por padrão
      const categoria = encontrarCategoria(
        categorias.filter((c) => c.tipo === "despesa"),
        parsed.categoriaNome,
      );
      const agora = new Date();
      const mes = agora.getMonth() + 1;
      const ano = agora.getFullYear();
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
      // Lança como receita ou despesa normal
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
