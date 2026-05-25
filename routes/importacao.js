// routes/importacao.js — Importação de extrato CSV
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

// POST /api/importacao/preview
// Recebe linhas do CSV já parseadas no frontend, retorna preview com sugestões
router.post("/preview", auth, async (req, res) => {
  const { linhas } = req.body; // [{ data, descricao, valor, tipo }]
  if (!Array.isArray(linhas) || linhas.length === 0)
    return res.status(400).json({ erro: "Nenhuma linha enviada." });

  try {
    const [categorias] = await db.query(
      "SELECT * FROM Categorias WHERE usuario_id = ? AND deleted_at IS NULL",
      [req.usuarioId],
    );
    const [contas] = await db.query(
      "SELECT * FROM Contas WHERE usuario_id = ?",
      [req.usuarioId],
    );

    // Sugestão de categoria por palavra-chave na descrição
    const sugerirCategoria = (descricao, tipo) => {
      if (!descricao) return null;
      const desc = descricao.toLowerCase();
      const cats = categorias.filter((c) => c.tipo === tipo);
      // Tenta match por nome da categoria
      const match = cats.find((c) => desc.includes(c.nome.toLowerCase()));
      if (match) return match.id;
      // Keywords comuns
      const keywords = {
        alimenta: "Alimentação",
        mercado: "Mercado",
        ifood: "Alimentação",
        uber: "Transporte",
        combustivel: "Combustível",
        posto: "Combustível",
        farmacia: "Farmácia",
        saude: "Saúde",
        medico: "Saúde",
        netflix: "Assinaturas",
        spotify: "Assinaturas",
        amazon: "Assinaturas",
        aluguel: "Moradia",
        condominio: "Moradia",
        energia: "Moradia",
        salario: "Salário",
        salário: "Salário",
        pagamento: "Salário",
      };
      for (const [kw, catNome] of Object.entries(keywords)) {
        if (desc.includes(kw)) {
          const c = cats.find((c) => c.nome === catNome);
          if (c) return c.id;
        }
      }
      return cats[0]?.id || null;
    };

    const preview = linhas.slice(0, 200).map((l, i) => {
      const tipo = parseFloat(l.valor) >= 0 ? "receita" : "despesa";
      return {
        idx: i,
        data: l.data,
        descricao: l.descricao,
        valor: Math.abs(parseFloat(l.valor) || 0),
        tipo: l.tipo || tipo,
        categoria_id: sugerirCategoria(l.descricao, l.tipo || tipo),
        conta_id: contas[0]?.id || null,
        importar: true,
      };
    });

    res.json({ preview, categorias, contas });
  } catch (err) {
    console.error("[Importacao preview]", err.message);
    res.status(500).json({ erro: "Erro ao processar preview." });
  }
});

// POST /api/importacao/confirmar
// Importa as linhas confirmadas pelo usuário
router.post("/confirmar", auth, async (req, res) => {
  const { linhas } = req.body;
  if (!Array.isArray(linhas) || linhas.length === 0)
    return res.status(400).json({ erro: "Nenhuma linha para importar." });

  const paraImportar = linhas.filter((l) => l.importar);
  if (paraImportar.length === 0)
    return res
      .status(400)
      .json({ erro: "Nenhuma linha marcada para importar." });

  try {
    let importados = 0,
      erros = 0;
    for (const l of paraImportar) {
      try {
        await db.query(
          `INSERT INTO Transacoes
             (usuario_id, conta_id, categoria_id, tipo, descricao, valor, data)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.usuarioId,
            l.conta_id || null,
            l.categoria_id || null,
            l.tipo,
            l.descricao,
            parseFloat(l.valor) || 0,
            l.data,
          ],
        );
        importados++;
      } catch {
        erros++;
      }
    }
    res.json({
      importados,
      erros,
      mensagem: `${importados} lançamento(s) importado(s)!`,
    });
  } catch (err) {
    console.error("[Importacao confirmar]", err.message);
    res.status(500).json({ erro: "Erro ao importar lançamentos." });
  }
});

module.exports = router;
