const express = require("express");
const router = express.Router();
const db = require("../config/db");
const auth = require("../middleware/auth");

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@controlai.app";

let webpush = null;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush = require("web-push");
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// GET /api/push/vapid-key — retorna chave pública para o cliente subscrever
router.get("/vapid-key", (req, res) => {
  if (!VAPID_PUBLIC) return res.status(503).json({ erro: "Push não configurado." });
  res.json({ publicKey: VAPID_PUBLIC });
});

// POST /api/push/subscribe — salva ou atualiza subscription do usuário
router.post("/subscribe", auth, async (req, res) => {
  if (!webpush) return res.status(503).json({ erro: "Push não configurado no servidor." });
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.auth || !keys?.p256dh)
    return res.status(400).json({ erro: "Dados de subscription inválidos." });
  try {
    // Remove subscriptions antigas do mesmo usuário com mesmo endpoint
    await db.query(
      "DELETE FROM PushSubscriptions WHERE usuario_id = ? AND endpoint = ?",
      [req.usuarioId, endpoint],
    );
    await db.query(
      "INSERT INTO PushSubscriptions (usuario_id, endpoint, auth, p256dh) VALUES (?, ?, ?, ?)",
      [req.usuarioId, endpoint, keys.auth, keys.p256dh],
    );
    res.json({ mensagem: "Subscription salva!" });
  } catch (err) {
    console.error("[Push subscribe]", err.message);
    res.status(500).json({ erro: "Erro ao salvar subscription." });
  }
});

// DELETE /api/push/unsubscribe — remove subscription
router.delete("/unsubscribe", auth, async (req, res) => {
  const { endpoint } = req.body;
  try {
    await db.query(
      "DELETE FROM PushSubscriptions WHERE usuario_id = ? AND endpoint = ?",
      [req.usuarioId, endpoint],
    );
    res.json({ mensagem: "Subscription removida." });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao remover subscription." });
  }
});

// Função utilitária — enviar push para um usuário (usada internamente)
async function enviarPushUsuario(usuarioId, title, body, url = "/dashboard.html") {
  if (!webpush) return;
  try {
    const [subs] = await db.query(
      "SELECT * FROM PushSubscriptions WHERE usuario_id = ?",
      [usuarioId],
    );
    const payload = JSON.stringify({ title, body, url });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
          payload,
        );
      } catch (e) {
        // Subscription expirada — remove
        if (e.statusCode === 410) {
          await db.query("DELETE FROM PushSubscriptions WHERE id = ?", [sub.id]);
        }
      }
    }
  } catch (err) {
    console.error("[enviarPushUsuario]", err.message);
  }
}

module.exports = { router, enviarPushUsuario };
