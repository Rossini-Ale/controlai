// ════════════════════════════════════════
// storage.js — Persistência local
// Rascunho automático + Fila offline
// ════════════════════════════════════════

const DRAFT_KEY = "controlai_draft_lancamento";
const QUEUE_KEY = "controlai_offline_queue";

// ── Rascunho automático ──
function salvarRascunho() {
  const draft = {
    tipo: document.getElementById("f-tipo")?.value,
    valor: document.getElementById("f-valor")?.value,
    valorRaw: document.getElementById("f-valor")?.dataset.valor,
    descricao: document.getElementById("f-descricao")?.value,
    categoria: document.getElementById("f-categoria")?.value,
    conta: document.getElementById("f-conta")?.value,
    data: document.getElementById("f-data")?.value,
    obs: document.getElementById("f-obs")?.value,
    ts: Date.now(),
  };
  if (draft.valor || draft.descricao) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }
}

function limparRascunho() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

function verificarRascunho() {
  let raw;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    if (Date.now() - draft.ts > 86400000) {
      limparRascunho();
      return;
    }
    if (!draft.valor && !draft.descricao) {
      limparRascunho();
      return;
    }

    const banner = document.createElement("div");
    banner.id = "draft-banner";
    banner.style.cssText = `
      position:fixed;bottom:80px;left:16px;right:16px;
      background:var(--bg-secondary);border:0.5px solid var(--border);
      border-radius:14px;padding:14px 16px;z-index:9990;
      display:flex;align-items:center;gap:12px;
      box-shadow:0 4px 20px rgba(0,0,0,0.25);
      animation:slideUpMenu 0.3s ease;
    `;
    banner.innerHTML = `
      <i class="fa-solid fa-file-pen" style="color:var(--green);font-size:18px;flex-shrink:0"></i>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">Rascunho encontrado</div>
        <div style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${draft.descricao || "Valor: " + draft.valor}
        </div>
      </div>
      <button onclick="restaurarRascunho()" style="background:var(--green);border:none;color:#fff;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0">Restaurar</button>
      <button onclick="document.getElementById('draft-banner')?.remove();limparRascunho();" style="background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px;flex-shrink:0"><i class="fa-solid fa-xmark"></i></button>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner?.remove(), 10000);
  } catch {
    limparRascunho();
  }
}

function restaurarRascunho() {
  let raw;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  document.getElementById("draft-banner")?.remove();
  try {
    const draft = JSON.parse(raw);
    if (typeof abrirModalLancamento !== "function") return;
    abrirModalLancamento();
    setTimeout(() => {
      if (draft.tipo && typeof selecionarTipoModal === "function")
        selecionarTipoModal(draft.tipo);
      const map = {
        "f-valor": (el) => {
          el.value = draft.valor;
          el.dataset.valor = draft.valorRaw || "";
        },
        "f-descricao": (el) => {
          el.value = draft.descricao || "";
        },
        "f-categoria": (el) => {
          el.value = draft.categoria || "";
        },
        "f-conta": (el) => {
          el.value = draft.conta || "";
        },
        "f-data": (el) => {
          el.value = draft.data || "";
        },
        "f-obs": (el) => {
          el.value = draft.obs || "";
        },
      };
      Object.entries(map).forEach(([id, fn]) => {
        const el = document.getElementById(id);
        if (el) fn(el);
      });
    }, 300);
  } catch {
    limparRascunho();
  }
}

function ativarAutoSaveDraft() {
  [
    "f-valor",
    "f-descricao",
    "f-categoria",
    "f-conta",
    "f-data",
    "f-obs",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", salvarRascunho);
    if (el.tagName === "SELECT") el.addEventListener("change", salvarRascunho);
  });
}

// ── Fila offline ──
function adicionarFilaOffline(endpoint, options, descricao) {
  try {
    const fila = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    fila.push({ endpoint, options, descricao, ts: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(fila));
  } catch {}
  toast(
    `"${descricao}" salvo offline. Será enviado quando a internet voltar.`,
    "aviso",
  );
}

async function processarFilaOffline() {
  let fila;
  try {
    fila = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return;
  }
  if (fila.length === 0) return;

  const restante = [];
  let enviados = 0;
  for (const item of fila) {
    try {
      await fetchAPI(item.endpoint, item.options);
      enviados++;
    } catch {
      restante.push(item);
    }
  }
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(restante));
  } catch {}
  if (enviados > 0) {
    toast(`${enviados} lançamento(s) offline sincronizado(s)! ✅`);
    if (typeof carregarDados === "function") carregarDados();
    if (typeof carregarTransacoes === "function") carregarTransacoes();
  }
}

window.addEventListener("online", () => setTimeout(processarFilaOffline, 1000));

document.addEventListener("DOMContentLoaded", () =>
  setTimeout(verificarRascunho, 1500),
);
