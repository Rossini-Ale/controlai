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
      <div style="
        background: var(--bg-secondary);
        border: 0.5px solid var(--border);
        border-radius: 16px;
        padding: 24px;
        width: 100%;
        max-width: 340px;
        animation: fadeUp 0.2s ease;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      ">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:38px;height:38px;background:rgba(239,68,68,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;font-size:16px"></i>
          </div>
          <h3 style="font-size:15px;font-weight:600;color:var(--text-primary)">${titulo}</h3>
        </div>
        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6">${mensagem}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="confirm-nao" style="
            background:transparent;border:0.5px solid var(--border);
            color:var(--text-secondary);border-radius:9px;padding:10px 20px;
            font-size:14px;cursor:pointer;transition:all 0.2s;
          ">Cancelar</button>
          <button id="confirm-sim" style="
            background:#ef4444;border:none;color:#fff;
            border-radius:9px;padding:10px 20px;
            font-size:14px;font-weight:600;cursor:pointer;
            margin-left:16px;
          ">Deletar</button>
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
      background:var(--bg-secondary);border:0.5px solid var(--border);
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
    <div style="background:var(--bg-secondary);border:0.5px solid var(--border);border-radius:14px;padding:20px">
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
      background:var(--bg-secondary);border:0.5px solid var(--border);border-radius:14px;
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
