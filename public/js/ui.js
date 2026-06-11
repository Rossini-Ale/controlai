// ── Feedback háptico ──
function haptic(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ── Frases variadas por tipo de ação ──
const _frases = {
  salvo: [
    "Registro salvo! 📝",
    "Mais um lançamento anotado! ✅",
    "Organização é tudo. Salvo! 🚀",
    "Seu bolso agradece o controle. Salvo!",
    "Anotado com sucesso! 💪",
  ],
  deletado: [
    "Item removido.",
    "Pronto, sumiu! 🗑️",
    "Deletado com sucesso.",
    "Item excluído.",
  ],
  atualizado: [
    "Atualizado! ✏️",
    "Alterações salvas.",
    "Tudo certo, atualizado! ✅",
  ],
  duplicado: [
    "Lançamento duplicado para hoje! 📋",
    "Cópia criada com sucesso!",
  ],
};

function toastVariado(acao) {
  const lista = _frases[acao];
  if (!lista) return;
  const msg = lista[Math.floor(Math.random() * lista.length)];
  toast(msg);
}

// ── Toast com barra de progresso ──
function toast(mensagem, tipo = "sucesso") {
  const cores = {
    sucesso: { bg: "#10b981", icon: "fa-check-circle" },
    erro: { bg: "#ef4444", icon: "fa-circle-xmark" },
    aviso: { bg: "#f59e0b", icon: "fa-triangle-exclamation" },
    info: { bg: "#3b82f6", icon: "fa-circle-info" },
  };
  const { bg, icon } = cores[tipo] || cores.sucesso;
  const DURACAO = 3000;

  // Remove toasts anteriores empilhados
  document.querySelectorAll(".toast-el").forEach((t) => t.remove());

  const el = document.createElement("div");
  el.className = "toast-el";
  el.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bg};
    color: #fff;
    padding: 12px 18px 0 18px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    max-width: 300px;
    overflow: hidden;
    animation: toastIn 0.3s ease;
  `;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding-bottom:10px">
      <i class="fa-solid ${icon}"></i>
      <span>${mensagem}</span>
    </div>
    <div class="toast-progress" style="
      position: absolute;
      bottom: 0; left: 0;
      height: 3px;
      width: 100%;
      background: rgba(255,255,255,0.4);
      border-radius: 0 0 12px 12px;
      transform-origin: left;
      transition: transform ${DURACAO}ms linear;
    "></div>
  `;

  // Estilos globais do toast (injeta uma vez)
  if (!document.getElementById("toast-styles")) {
    const style = document.createElement("style");
    style.id = "toast-styles";
    style.textContent = `
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(110%); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes toastOut {
        from { opacity: 1; transform: translateX(0); }
        to   { opacity: 0; transform: translateX(110%); }
      }
      @media (max-width: 768px) {
        .toast-el {
          top: auto !important;
          bottom: 90px !important;
          right: 16px !important;
          left: 16px !important;
          max-width: calc(100% - 32px) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(el);

  // Inicia barra de progresso no próximo frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const bar = el.querySelector(".toast-progress");
      if (bar) bar.style.transform = "scaleX(0)";
    });
  });

  // Remove após duração
  const timer = setTimeout(() => {
    el.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => el.remove(), 300);
  }, DURACAO);

  // Clique antecipa o dismiss
  el.addEventListener("click", () => {
    clearTimeout(timer);
    el.style.animation = "toastOut 0.2s ease forwards";
    setTimeout(() => el.remove(), 200);
  });
}

// ── Confirm customizado com variáveis CSS ──
function confirmar(mensagem, titulo = "Confirmar") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(2px);
    `;

    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog-header">
          <div class="confirm-icon-wrap">
            <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;font-size:16px"></i>
          </div>
          <h3>${titulo}</h3>
        </div>
        <p>${mensagem}</p>
        <div class="confirm-dialog-actions">
          <button id="confirm-nao" class="btn-edit" style="padding:10px 20px">Cancelar</button>
          <button id="confirm-sim" class="btn-danger" style="padding:10px 20px">Deletar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector("#confirm-sim").onclick = () => {
      overlay.remove();
      resolve(true);
    };
    overlay.querySelector("#confirm-nao").onclick = () => {
      overlay.remove();
      resolve(false);
    };
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    };

    // Foco no cancelar por segurança (evita Enter acidental confirmando)
    setTimeout(() => overlay.querySelector("#confirm-nao").focus(), 50);
  });
}

// ── Skeleton lista ──
function skeletonLista(quantidade = 3) {
  return (
    Array(quantidade)
      .fill(0)
      .map(
        () => `
    <div style="
      background:var(--bg-secondary);border:1px solid var(--border-subtle);
      border-radius:14px;padding:16px;margin-bottom:10px;
    ">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <div class="skel-pulse" style="width:58%;height:15px;background:var(--bg-tertiary);border-radius:6px"></div>
        <div class="skel-pulse" style="width:20%;height:15px;background:var(--bg-tertiary);border-radius:6px"></div>
      </div>
      <div class="skel-pulse" style="width:38%;height:11px;background:var(--bg-tertiary);border-radius:6px"></div>
    </div>
  `,
      )
      .join("") + _skelStyle()
  );
}

function skeletonCards(quantidade = 4) {
  return (
    Array(quantidade)
      .fill(0)
      .map(
        () => `
    <div style="background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:14px;padding:20px">
      <div class="skel-pulse" style="width:48%;height:11px;background:var(--bg-tertiary);border-radius:6px;margin-bottom:12px"></div>
      <div class="skel-pulse" style="width:68%;height:22px;background:var(--bg-tertiary);border-radius:6px"></div>
    </div>
  `,
      )
      .join("") + _skelStyle()
  );
}

function _skelStyle() {
  if (document.getElementById("skel-style")) return "";
  const s = document.createElement("style");
  s.id = "skel-style";
  s.textContent = `
    @keyframes shimmer {
      0%   { opacity: 1; }
      50%  { opacity: 0.35; }
      100% { opacity: 1; }
    }
    .skel-pulse { animation: shimmer 1.4s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
  return "";
}

// ── Empty state ──
function emptyState(icone, titulo, descricao, btnLabel, btnFn) {
  return `
    <div style="
      text-align:center;padding:48px 24px;
      background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:14px;
    ">
      <div style="
        width:64px;height:64px;background:var(--bg-tertiary);border-radius:50%;
        display:flex;align-items:center;justify-content:center;margin:0 auto 16px;
      ">
        <i class="fa-solid ${icone}" style="font-size:24px;color:var(--text-muted)"></i>
      </div>
      <h3 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px">${titulo}</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;line-height:1.5">${descricao}</p>
      ${
        btnLabel
          ? `
        <button onclick="${btnFn}" style="
          background:var(--green);color:#fff;border:none;border-radius:9px;
          padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;
          display:inline-flex;align-items:center;gap:6px;
        "><i class='fa-solid fa-plus'></i> ${btnLabel}</button>`
          : ""
      }
    </div>
  `;
}

// ── Empty State Rico com ilustração SVG ──
function emptyStateRich(tipo = "lancamentos", temFiltro = false) {
  const configs = {
    lancamentos: {
      svg: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="12" y="18" width="56" height="44" rx="8" fill="var(--bg-tertiary)" stroke="var(--border-subtle)" stroke-width="1.5"/>
        <rect x="20" y="28" width="24" height="3" rx="1.5" fill="var(--border-subtle)"/>
        <rect x="20" y="35" width="36" height="3" rx="1.5" fill="var(--border-subtle)"/>
        <rect x="20" y="42" width="30" height="3" rx="1.5" fill="var(--border-subtle)"/>
        <rect x="20" y="49" width="18" height="3" rx="1.5" fill="var(--border-subtle)"/>
        <circle cx="60" cy="58" r="12" fill="var(--bg-secondary)" stroke="var(--border-subtle)" stroke-width="1.5"/>
        <path d="M60 53v5l3 2" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      titulo: "Nenhum lançamento neste mês",
      texto: "Registre receitas, despesas e transferências para acompanhar seu fluxo financeiro.",
      btn: { label: "Novo lançamento", fn: "abrirModalLancamento()" },
    },
    filtro: {
      svg: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="36" cy="36" r="18" fill="var(--bg-tertiary)" stroke="var(--border-subtle)" stroke-width="1.5"/>
        <path d="M49 49l10 10" stroke="var(--border-subtle)" stroke-width="3" stroke-linecap="round"/>
        <path d="M30 36h12M33 31h6M27 41h18" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      titulo: "Nenhum resultado",
      texto: "Nenhuma transação corresponde aos filtros selecionados. Tente ampliar o período ou remover filtros.",
      btn: null,
    },
    recorrentes: {
      svg: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="40" cy="40" r="22" fill="var(--bg-tertiary)" stroke="var(--border-subtle)" stroke-width="1.5"/>
        <path d="M29 40a11 11 0 0 1 19-7.5" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M51 40a11 11 0 0 1-19 7.5" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M45 29l3 3.5-3.5 3" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M35 51l-3-3.5 3.5-3" stroke="var(--text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      titulo: "Nenhuma recorrência cadastrada",
      texto: "Crie recorrências para despesas e receitas fixas — elas geram lançamentos automaticamente todo mês.",
      btn: { label: "Nova recorrência", fn: "abrirModalRec()" },
    },
  };

  const c = (temFiltro ? configs.filtro : configs[tipo]) || configs.lancamentos;
  return `
    <div style="text-align:center;padding:56px 24px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:14px">
      <div style="margin:0 auto 20px;display:flex;align-items:center;justify-content:center">${c.svg}</div>
      <h3 style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:8px">${c.titulo}</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:${c.btn ? "24px" : "0"};line-height:1.6;max-width:280px;margin-left:auto;margin-right:auto">${c.texto}</p>
      ${c.btn ? `<button onclick="${c.btn.fn}" style="background:var(--green);color:#fff;border:none;border-radius:9px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px"><i class='fa-solid fa-plus'></i> ${c.btn.label}</button>` : ""}
    </div>
  `;
}

// ── Toast com ação de Desfazer ──
function toastComUndo(mensagem, onUndo, duracao = 4000, onConfirm) {
  document.querySelectorAll(".toast-el,.toast-undo-el").forEach((t) => t.remove());

  if (!document.getElementById("toast-undo-styles")) {
    const s = document.createElement("style");
    s.id = "toast-undo-styles";
    s.textContent = `
      @keyframes toastIn  { from{opacity:0;transform:translateX(110%)} to{opacity:1;transform:translateX(0)} }
      @keyframes toastOut { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(110%)} }
      @media(max-width:768px){.toast-undo-el{top:auto!important;bottom:90px!important;right:16px!important;left:16px!important;max-width:calc(100% - 32px)!important}}
    `;
    document.head.appendChild(s);
  }

  const el = document.createElement("div");
  el.className = "toast-undo-el";
  el.style.cssText = `
    position:fixed;top:20px;right:20px;
    background:var(--bg-secondary);color:var(--text-primary);
    padding:12px 16px;border-radius:12px;font-size:14px;font-weight:500;
    z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,0.4);
    max-width:320px;border:1px solid var(--border-subtle);
    overflow:hidden;animation:toastIn 0.3s ease;
    display:flex;align-items:center;gap:12px;
  `;
  el.innerHTML = `
    <i class="fa-solid fa-trash-can" style="color:var(--text-muted);flex-shrink:0"></i>
    <span style="flex:1;font-size:13px">${mensagem}</span>
    <button class="undo-btn" style="
      background:var(--green);border:none;color:#fff;
      border-radius:7px;padding:5px 12px;font-size:12px;
      font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;
    ">Desfazer</button>
    <div style="position:absolute;bottom:0;left:0;height:3px;width:100%;background:var(--bg-tertiary)">
      <div class="undo-progress" style="height:100%;width:100%;background:var(--green);transition:width ${duracao}ms linear"></div>
    </div>
  `;
  document.body.appendChild(el);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const bar = el.querySelector(".undo-progress");
    if (bar) bar.style.width = "0%";
  }));

  const timer = setTimeout(() => {
    el.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => el.remove(), 300);
    onConfirm?.();
  }, duracao);

  el.querySelector(".undo-btn").onclick = (e) => {
    e.stopPropagation();
    clearTimeout(timer);
    el.style.animation = "toastOut 0.2s ease forwards";
    setTimeout(() => el.remove(), 200);
    onUndo?.();
    toast("Ação desfeita.", "info");
  };
}

// ── Animação de entrada em stagger para listas ──
function animarEntrada(containerEl, seletor = ":scope > *") {
  if (!containerEl) return;
  const items = containerEl.querySelectorAll(seletor);
  if (!items.length) return;
  if (!document.getElementById("entrada-style")) {
    const s = document.createElement("style");
    s.id = "entrada-style";
    s.textContent = `
      @keyframes fadeInUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      .animar-entrada { animation:fadeInUp 0.28s ease both; }
    `;
    document.head.appendChild(s);
  }
  items.forEach((el, i) => {
    el.classList.add("animar-entrada");
    el.style.animationDelay = `${Math.min(i * 45, 360)}ms`;
  });
}

// ── Barra de progresso global (estilo NProgress) ──
(function () {
  let _bar = null, _active = 0, _timer = null;
  function _getBar() {
    if (!_bar) {
      _bar = document.createElement("div");
      _bar.style.cssText = "position:fixed;top:0;left:0;height:3px;width:0%;background:var(--green);z-index:9998;transition:width 0.3s ease,opacity 0.4s ease;opacity:0;pointer-events:none;box-shadow:0 0 6px rgba(16,185,129,0.5)";
      document.body.appendChild(_bar);
    }
    return _bar;
  }
  window.npStart = function () {
    _active++;
    clearTimeout(_timer);
    const b = _getBar();
    b.style.transition = "width 0.3s ease,opacity 0.1s ease";
    b.style.opacity = "1";
    b.style.width = "0%";
    requestAnimationFrame(() => { b.style.width = "40%"; });
    _timer = setTimeout(() => { b.style.width = "70%"; }, 500);
  };
  window.npDone = function () {
    _active = Math.max(0, _active - 1);
    if (_active > 0) return;
    clearTimeout(_timer);
    const b = _getBar();
    b.style.transition = "width 0.2s ease,opacity 0.4s ease";
    b.style.width = "100%";
    _timer = setTimeout(() => {
      b.style.opacity = "0";
      setTimeout(() => { if (_active === 0) b.style.width = "0%"; }, 400);
    }, 200);
  };
  // Envolve fetchAPI com a barra de progresso
  const _origFetch = window.fetchAPI;
  if (typeof _origFetch === "function") {
    window.fetchAPI = async function (endpoint, options) {
      npStart();
      try { return await _origFetch(endpoint, options); }
      finally { npDone(); }
    };
  }
})();
