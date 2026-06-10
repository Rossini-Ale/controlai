const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { Resend } = require("resend");
const db = require("../config/db");
const auth = require("../middleware/auth");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de login. Tente novamente em 15 minutos." },
});

const cadastroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas contas criadas neste IP. Tente novamente em 1 hora." },
});

const esqueciLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas solicitações de recuperação. Tente novamente em 15 minutos." },
});

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const CATEGORIAS_PADRAO = [
  {
    nome: "Alimentação",
    tipo: "despesa",
    icone: "fa-utensils",
    cor: "#ef4444",
  },
  { nome: "Transporte", tipo: "despesa", icone: "fa-car", cor: "#f97316" },
  { nome: "Saúde", tipo: "despesa", icone: "fa-heart-pulse", cor: "#ec4899" },
  {
    nome: "Educação",
    tipo: "despesa",
    icone: "fa-graduation-cap",
    cor: "#8b5cf6",
  },
  { nome: "Lazer", tipo: "despesa", icone: "fa-gamepad", cor: "#06b6d4" },
  { nome: "Vestuário", tipo: "despesa", icone: "fa-shirt", cor: "#6366f1" },
  { nome: "Moradia", tipo: "despesa", icone: "fa-house", cor: "#84cc16" },
  { nome: "Assinaturas", tipo: "despesa", icone: "fa-tv", cor: "#14b8a6" },
  { nome: "Eletrônicos", tipo: "despesa", icone: "fa-laptop", cor: "#3b82f6" },
  { nome: "Pet", tipo: "despesa", icone: "fa-dog", cor: "#a78bfa" },
  { nome: "Viagem", tipo: "despesa", icone: "fa-plane", cor: "#f59e0b" },
  {
    nome: "Mercado",
    tipo: "despesa",
    icone: "fa-cart-shopping",
    cor: "#10b981",
  },
  { nome: "Restaurante", tipo: "despesa", icone: "fa-burger", cor: "#ef4444" },
  {
    nome: "Combustível",
    tipo: "despesa",
    icone: "fa-gas-pump",
    cor: "#f97316",
  },
  { nome: "Farmácia", tipo: "despesa", icone: "fa-pills", cor: "#ec4899" },
  { nome: "Outros", tipo: "despesa", icone: "fa-tag", cor: "#6b7280" },
  { nome: "Salário", tipo: "receita", icone: "fa-money-bill", cor: "#10b981" },
  { nome: "Freelance", tipo: "receita", icone: "fa-briefcase", cor: "#06b6d4" },
  {
    nome: "Investimentos",
    tipo: "receita",
    icone: "fa-piggy-bank",
    cor: "#8b5cf6",
  },
  {
    nome: "Transferência",
    tipo: "receita",
    icone: "fa-right-left",
    cor: "#3b82f6",
  },
  { nome: "Outros", tipo: "receita", icone: "fa-tag", cor: "#6b7280" },
];

// Cadastro
router.post("/cadastro", cadastroLimiter, async (req, res) => {
  const { nome, email, username, senha } = req.body;
  try {
    const hash = await bcrypt.hash(senha, 10);
    const [result] = await db.query(
      "INSERT INTO Usuarios (nome, email, username, senha) VALUES (?, ?, ?, ?)",
      [nome, email, username, hash],
    );
    const usuarioId = result.insertId;

    for (const cat of CATEGORIAS_PADRAO) {
      await db.query(
        "INSERT INTO Categorias (usuario_id, nome, tipo, icone, cor) VALUES (?, ?, ?, ?, ?)",
        [usuarioId, cat.nome, cat.tipo, cat.icone, cat.cor],
      );
    }

    await db.query(
      "INSERT INTO Contas (usuario_id, nome, tipo, saldo_inicial, cor) VALUES (?, ?, ?, ?, ?)",
      [usuarioId, "Carteira", "carteira", 0, "#10b981"],
    );

    res.status(201).json({ mensagem: "Usuário criado com sucesso!" });

    // Email de boas-vindas (não bloqueia a resposta)
    if (email) {
      const appUrl = process.env.APP_URL || "https://controlai.up.railway.app";
      const from = process.env.RESEND_FROM_EMAIL || "Controlaí <noreply@controlai.up.railway.app>";
      getResend().emails.send({
        from,
        to: email,
        subject: "Bem-vindo ao Controlaí! 🎉",
        html: `
          <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#0f1117;color:#fff;border-radius:16px;padding:40px;border:1px solid #2d3748">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
              <div style="width:36px;height:36px;background:linear-gradient(135deg,#10b981,#059669);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px">💹</div>
              <span style="font-size:18px;font-weight:700">controlaí</span>
            </div>
            <h2 style="font-size:22px;font-weight:700;margin-bottom:12px">Bem-vindo, ${nome}! 👋</h2>
            <p style="color:#9ca3af;margin-bottom:20px;line-height:1.7">
              Sua conta foi criada com sucesso. Agora você tem tudo que precisa para organizar suas finanças de um jeito simples e rápido.
            </p>
            <div style="background:#1a1f2e;border:0.5px solid #2d3748;border-radius:12px;padding:20px;margin-bottom:28px">
              <p style="font-size:13px;font-weight:600;color:#9ca3af;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px">Por onde começar</p>
              <div style="display:flex;flex-direction:column;gap:10px">
                <div style="display:flex;align-items:center;gap:10px;font-size:14px">
                  <span style="color:#10b981">✓</span> Adicione suas contas e saldo inicial
                </div>
                <div style="display:flex;align-items:center;gap:10px;font-size:14px">
                  <span style="color:#10b981">✓</span> Registre seus primeiros lançamentos
                </div>
                <div style="display:flex;align-items:center;gap:10px;font-size:14px">
                  <span style="color:#10b981">✓</span> Configure transações recorrentes
                </div>
                <div style="display:flex;align-items:center;gap:10px;font-size:14px">
                  <span style="color:#10b981">✓</span> Conecte o bot do Telegram para lançar gastos na hora
                </div>
              </div>
            </div>
            <a href="${appUrl}/dashboard.html" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px">
              Ir para o Dashboard →
            </a>
          </div>
        `,
      }).catch(() => {}); // silencia erro de email para não afetar o cadastro
    }
  } catch (err) {
    res.status(400).json({ erro: "Email ou username já cadastrado." });
  }
});

// Login
router.post("/login", loginLimiter, async (req, res) => {
  const { username, senha } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM Usuarios WHERE username = ?", [
      username,
    ]);
    if (rows.length === 0) {
      return res.status(401).json({ erro: "Usuário não encontrado." });
    }
    const usuario = rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Senha incorreta." });
    }
    const token = jwt.sign(
      { id: usuario.id, username: usuario.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({
      token,
      nome: usuario.nome,
      username: usuario.username,
      onboarding_completo: usuario.onboarding_completo,
    });
  } catch (err) {
    res.status(500).json({ erro: "Erro interno do servidor." });
  }
});

// Buscar perfil
router.get("/perfil", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nome, email, username, telegram_chat_id, created_at FROM Usuarios WHERE id = ?",
      [req.usuarioId],
    );
    if (rows.length === 0)
      return res.status(404).json({ erro: "Usuário não encontrado." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar perfil." });
  }
});

// Atualizar perfil
router.put("/perfil", auth, async (req, res) => {
  const { nome, email } = req.body;
  try {
    await db.query("UPDATE Usuarios SET nome=?, email=? WHERE id=?", [
      nome,
      email,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Perfil atualizado!" });
  } catch (err) {
    res.status(500).json({ erro: "Email já cadastrado." });
  }
});

// Alterar senha
router.put("/perfil/senha", auth, async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM Usuarios WHERE id=?", [
      req.usuarioId,
    ]);
    const usuario = rows[0];
    const senhaValida = await bcrypt.compare(senha_atual, usuario.senha);
    if (!senhaValida)
      return res.status(401).json({ erro: "Senha atual incorreta." });
    const hash = await bcrypt.hash(nova_senha, 10);
    await db.query("UPDATE Usuarios SET senha=? WHERE id=?", [
      hash,
      req.usuarioId,
    ]);
    res.json({ mensagem: "Senha alterada com sucesso!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao alterar senha." });
  }
});

// Status do onboarding
router.get("/onboarding", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        u.onboarding_completo,
        (SELECT COUNT(*) FROM Contas WHERE usuario_id = u.id) as tem_conta,
        (SELECT COUNT(*) FROM Transacoes WHERE usuario_id = u.id) as tem_transacao,
        (SELECT COUNT(*) FROM Cartoes WHERE usuario_id = u.id) as tem_cartao,
        u.telegram_chat_id
       FROM Usuarios u WHERE u.id = ?`,
      [req.usuarioId],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ erro: "Erro ao buscar onboarding." });
  }
});

// Solicitar recuperação de senha
router.post("/esqueci-senha", esqueciLimiter, async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query(
      "SELECT id, nome FROM Usuarios WHERE email = ?",
      [email],
    );
    // Sempre responde com sucesso para não revelar se o email existe
    if (rows.length === 0) {
      return res.json({ mensagem: "Se o email existir, você receberá o link." });
    }
    const usuario = rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await db.query(
      "INSERT INTO PasswordResets (usuario_id, token, expires_at) VALUES (?, ?, ?)",
      [usuario.id, token, expires],
    );

    const appUrl = process.env.APP_URL || "https://controlai.up.railway.app";
    const link = `${appUrl}/redefinir-senha.html?token=${token}`;
    const from = process.env.RESEND_FROM_EMAIL || "Controlaí <noreply@controlai.up.railway.app>";

    await getResend().emails.send({
      from,
      to: email,
      subject: "Redefinir senha — Controlaí",
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#0f1117;color:#fff;border-radius:16px;padding:40px;border:1px solid #2d3748">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#10b981,#059669);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px">💹</div>
            <span style="font-size:18px;font-weight:700">controlaí</span>
          </div>
          <h2 style="font-size:22px;font-weight:700;margin-bottom:12px">Redefinir sua senha</h2>
          <p style="color:#9ca3af;margin-bottom:28px;line-height:1.6">
            Olá, <strong style="color:#fff">${usuario.nome}</strong>!<br />
            Recebemos uma solicitação para redefinir a senha da sua conta.<br />
            Clique no botão abaixo para criar uma nova senha. O link expira em <strong style="color:#fff">1 hora</strong>.
          </p>
          <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;margin-bottom:28px">
            Redefinir senha →
          </a>
          <p style="color:#6b7280;font-size:12px;line-height:1.6;border-top:1px solid #2d3748;padding-top:20px">
            Se você não solicitou isso, ignore este email. Sua senha não será alterada.<br />
            Link direto: <a href="${link}" style="color:#10b981">${link}</a>
          </p>
        </div>
      `,
    });

    res.json({ mensagem: "Se o email existir, você receberá o link." });
  } catch (err) {
    console.error("[EsqueciSenha]", err.message);
    res.status(500).json({ erro: "Erro ao enviar email." });
  }
});

// Validar token
router.get("/validar-token/:token", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM PasswordResets WHERE token = ? AND used = 0 AND expires_at > NOW()",
      [req.params.token],
    );
    if (rows.length === 0) {
      return res.status(400).json({ valido: false });
    }
    res.json({ valido: true });
  } catch (err) {
    res.status(500).json({ valido: false });
  }
});

// Redefinir senha
router.post("/redefinir-senha", async (req, res) => {
  const { token, nova_senha } = req.body;
  try {
    const [rows] = await db.query(
      "SELECT * FROM PasswordResets WHERE token = ? AND used = 0 AND expires_at > NOW()",
      [token],
    );
    if (rows.length === 0) {
      return res.status(400).json({ erro: "Link inválido ou expirado." });
    }
    const reset = rows[0];
    const hash = await bcrypt.hash(nova_senha, 10);
    await db.query("UPDATE Usuarios SET senha = ? WHERE id = ?", [
      hash,
      reset.usuario_id,
    ]);
    await db.query("UPDATE PasswordResets SET used = 1 WHERE id = ?", [
      reset.id,
    ]);
    res.json({ mensagem: "Senha redefinida com sucesso!" });
  } catch (err) {
    console.error("[RedefinirSenha]", err.message);
    res.status(500).json({ erro: "Erro ao redefinir senha." });
  }
});

// Marcar onboarding como completo
router.post("/onboarding", auth, async (req, res) => {
  try {
    await db.query("UPDATE Usuarios SET onboarding_completo=1 WHERE id=?", [
      req.usuarioId,
    ]);
    res.json({ mensagem: "Onboarding completo!" });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao atualizar onboarding." });
  }
});

module.exports = router;
