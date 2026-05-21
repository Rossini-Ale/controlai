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
  if (!(await pedirPermissaoNotificacao())) return;
  try {
    const data = await fetchAPI("/api/recorrentes/vencendo?dias=0");
    notificarVencimentos(Array.isArray(data) ? data : []);
  } catch {
    /* silencioso */
  }
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
});
