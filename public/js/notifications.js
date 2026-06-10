// ════════════════════════════════════════
// notifications.js — Notificações + Favicon
// ════════════════════════════════════════

// ── Favicon dinâmico ──
async function atualizarFavicon() {
  try {
    const data = await fetchAPI("/api/recorrentes/vencendo?dias=0");
    const total = Array.isArray(data) ? data.length : 0;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.roundRect(0, 0, 32, 32, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C", 16, 17);

    if (total > 0) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(26, 6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText(total > 9 ? "9+" : String(total), 26, 6);
    }

    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = canvas.toDataURL("image/png");
  } catch {
    /* silencioso */
  }
}

// ── Notificações Web ──
async function pedirPermissaoNotificacao() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

function notificarVencimentos(lista) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  if (!lista?.length) return;
  const hoje = new Date().toISOString().split("T")[0];
  const hojeList = lista.filter(
    (r) => r.proxima_geracao?.split("T")[0] === hoje,
  );
  if (!hojeList.length) return;
  const nomes = hojeList.map((r) => r.descricao).join(", ");
  new Notification("Controlaí — Vencimento hoje!", {
    body:
      hojeList.length === 1
        ? `"${nomes}" vence hoje. Não se esqueça!`
        : `${hojeList.length} contas vencem hoje: ${nomes}`,
    tag: "controlai-vencimento",
  });
}

async function verificarENotificar() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const data = await fetchAPI("/api/recorrentes/vencendo?dias=0");
    notificarVencimentos(Array.isArray(data) ? data : []);
  } catch { /* silencioso */ }
}

// ── CTA: convida o usuário a ativar notificações ──
function mostrarCtaNotificacao() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  if (localStorage.getItem("controlai_notif_dispensado")) return;

  const CTA_ID = "notif-cta-banner";
  if (document.getElementById(CTA_ID)) return;

  const banner = document.createElement("div");
  banner.id = CTA_ID;
  banner.style.cssText = `
    display:flex;align-items:center;gap:10px;
    background:rgba(59,130,246,0.08);border:0.5px solid rgba(59,130,246,0.3);
    border-radius:10px;padding:10px 14px;margin-bottom:16px;
    animation:fadeInUp 0.3s ease both;
  `;
  banner.innerHTML = `
    <i class="fa-solid fa-bell" style="color:#3b82f6;font-size:14px;flex-shrink:0"></i>
    <span style="font-size:13px;color:var(--text-secondary);flex:1">Ative notificações para ser alertado sobre vencimentos</span>
    <button onclick="ativarNotificacoes()" style="background:#3b82f6;border:none;color:#fff;border-radius:7px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">Ativar</button>
    <button onclick="dispensarNotifCta()" style="background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:0 2px;line-height:1">×</button>
  `;

  const alvo = document.getElementById("checklist-wrap") || document.getElementById("cards-resumo");
  alvo?.parentNode.insertBefore(banner, alvo);
}

async function ativarNotificacoes() {
  const ok = await pedirPermissaoNotificacao();
  document.getElementById("notif-cta-banner")?.remove();
  if (ok) {
    toast("Notificações ativadas!");
    verificarENotificar();
  } else {
    toast("Permissão negada. Ative nas configurações do navegador.", "aviso");
  }
}

function dispensarNotifCta() {
  document.getElementById("notif-cta-banner")?.remove();
  localStorage.setItem("controlai_notif_dispensado", "1");
}

// ── Visibilidade: atualiza ao voltar para a aba ──
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (typeof carregarDados === "function") carregarDados();
  else if (typeof carregarResumo === "function") carregarResumo();
  atualizarFavicon();
});

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(atualizarFavicon, 2000);
  setTimeout(verificarENotificar, 3000);
  setTimeout(mostrarCtaNotificacao, 4000);
});
