const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

function getStripe() {
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

// GET /status — plano atual + uso do mês
router.get("/status", auth, async (req, res) => {
  try {
    const [[u]] = await db.query(
      "SELECT plano, stripe_subscription_id FROM Usuarios WHERE id=?",
      [req.usuarioId],
    );
    const mes = new Date().getMonth() + 1;
    const ano = new Date().getFullYear();
    const [[{ transacoes_mes }]] = await db.query(
      `SELECT COUNT(*) AS transacoes_mes FROM Transacoes
       WHERE usuario_id=? AND MONTH(data)=? AND YEAR(data)=? AND deleted_at IS NULL`,
      [req.usuarioId, mes, ano],
    );
    const plano = u?.plano || "free";
    res.json({
      plano,
      transacoes_mes,
      limite_transacoes: plano === "pro" ? null : 30,
    });
  } catch (err) {
    console.error("[PagamentosStatus]", err.message);
    res.status(500).json({ erro: "Erro ao buscar status do plano." });
  }
});

// POST /criar-sessao — cria sessão de checkout Stripe
router.post("/criar-sessao", auth, async (req, res) => {
  try {
    const [[u]] = await db.query(
      "SELECT nome, email, stripe_customer_id FROM Usuarios WHERE id=?",
      [req.usuarioId],
    );
    const stripe = getStripe();
    const appUrl = process.env.APP_URL || "https://controlai.up.railway.app";

    let customerId = u.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: u.email,
        name: u.nome,
        metadata: { usuario_id: String(req.usuarioId) },
      });
      customerId = customer.id;
      await db.query(
        "UPDATE Usuarios SET stripe_customer_id=? WHERE id=?",
        [customerId, req.usuarioId],
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/dashboard.html?upgrade=success`,
      cancel_url: `${appUrl}/planos.html`,
      metadata: { usuario_id: String(req.usuarioId) },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[CriarSessao]", err.message);
    res.status(500).json({ erro: "Erro ao criar sessão de pagamento." });
  }
});

// POST /portal — portal de gerenciamento da assinatura
router.post("/portal", auth, async (req, res) => {
  try {
    const [[u]] = await db.query(
      "SELECT stripe_customer_id FROM Usuarios WHERE id=?",
      [req.usuarioId],
    );
    if (!u?.stripe_customer_id) {
      return res.status(400).json({ erro: "Nenhuma assinatura ativa." });
    }
    const stripe = getStripe();
    const appUrl = process.env.APP_URL || "https://controlai.up.railway.app";
    const session = await stripe.billingPortal.sessions.create({
      customer: u.stripe_customer_id,
      return_url: `${appUrl}/dashboard.html`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("[Portal]", err.message);
    res.status(500).json({ erro: "Erro ao abrir portal de assinatura." });
  }
});

// Webhook handler — exportado separadamente (precisa de raw body)
async function handleWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[Webhook] Assinatura inválida:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const usuarioId = session.metadata?.usuario_id;
        if (!usuarioId) break;
        await db.query(
          "UPDATE Usuarios SET plano='pro', stripe_subscription_id=? WHERE id=?",
          [session.subscription, usuarioId],
        );
        console.log(`✅ Plano Pro ativado: usuário ${usuarioId}`);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        if (sub.status === "active") {
          await db.query(
            "UPDATE Usuarios SET plano='pro' WHERE stripe_subscription_id=?",
            [sub.id],
          );
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await db.query(
          "UPDATE Usuarios SET plano='free', stripe_subscription_id=NULL WHERE stripe_subscription_id=?",
          [sub.id],
        );
        console.log(`⬇️  Plano revertido para free: sub ${sub.id}`);
        break;
      }
    }
  } catch (err) {
    console.error("[Webhook] Erro ao processar evento:", err.message);
  }

  res.json({ received: true });
}

module.exports = { router, handleWebhook };
