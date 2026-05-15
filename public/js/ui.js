// ── Toast ──
function toast(mensagem, tipo = "sucesso") {
  const cores = {
    sucesso: { bg: "#10b981", icon: "fa-check-circle" },
    erro: { bg: "#ef4444", icon: "fa-circle-xmark" },
    aviso: { bg: "#f59e0b", icon: "fa-triangle-exclamation" },
    info: { bg: "#3b82f6", icon: "fa-circle-info" },
  };
  const { bg, icon } = cores[tipo] || cores.sucesso;

  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bg};
    color: #fff;
    padding: 12px 18px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${mensagem}`;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100%); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(100%); }
    }
    @media (max-width: 768px) {
      .toast-el {
        top: auto !important;
        bottom: 90px !important;
        right: 16px !important;
        left: 16px !important;
        max-width: 100% !important;
      }
    }
  `;
  el.classList.add("toast-el");
  document.head.appendChild(style);
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Confirm customizado ──
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
    `;

    overlay.innerHTML = `
      <div style="
        background: #1a1f2e;
        border: 0.5px solid #2d3748;
        border-radius: 16px;
        padding: 24px;
        width: 100%;
        max-width: 340px;
        animation: fadeUp 0.2s ease;
      ">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:36px;height:36px;background:rgba(239,68,68,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center">
            <i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;font-size:16px"></i>
          </div>
          <h3 style="font-size:15px;font-weight:600;color:#fff">${titulo}</h3>
        </div>
        <p style="font-size:14px;color:#9ca3af;margin-bottom:20px;line-height:1.5">${mensagem}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="confirm-nao" style="
            background: transparent; border: 0.5px solid #2d3748;
            color: #9ca3af; border-radius: 9px; padding: 9px 18px;
            font-size: 14px; cursor: pointer;
          ">Cancelar</button>
          <button id="confirm-sim" style="
            background: #ef4444; border: none; color: #fff;
            border-radius: 9px; padding: 9px 18px;
            font-size: 14px; font-weight: 600; cursor: pointer;
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
  });
}

// ── Skeleton ──
function skeletonLista(quantidade = 3) {
  return Array(quantidade)
    .fill(0)
    .map(
      () => `
    <div style="
      background: #1a1f2e;
      border: 0.5px solid #2d3748;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 10px;
    ">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <div style="width:60%;height:16px;background:#242938;border-radius:6px;animation:pulse 1.5s infinite"></div>
        <div style="width:20%;height:16px;background:#242938;border-radius:6px;animation:pulse 1.5s infinite"></div>
      </div>
      <div style="width:40%;height:12px;background:#242938;border-radius:6px;animation:pulse 1.5s infinite"></div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      </style>
    </div>
  `,
    )
    .join("");
}

function skeletonCards(quantidade = 4) {
  return Array(quantidade)
    .fill(0)
    .map(
      () => `
    <div style="
      background: #1a1f2e;
      border: 0.5px solid #2d3748;
      border-radius: 14px;
      padding: 20px;
    ">
      <div style="width:50%;height:12px;background:#242938;border-radius:6px;animation:pulse 1.5s infinite;margin-bottom:12px"></div>
      <div style="width:70%;height:24px;background:#242938;border-radius:6px;animation:pulse 1.5s infinite"></div>
    </div>
  `,
    )
    .join("");
}

// ── Empty state ──
function emptyState(icone, titulo, descricao, btnLabel, btnFn) {
  return `
    <div style="
      text-align: center;
      padding: 48px 24px;
      background: #1a1f2e;
      border: 0.5px solid #2d3748;
      border-radius: 14px;
    ">
      <div style="
        width: 64px; height: 64px;
        background: #242938;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 16px;
      ">
        <i class="fa-solid ${icone}" style="font-size:24px;color:#6b7280"></i>
      </div>
      <h3 style="font-size:16px;font-weight:600;color:#fff;margin-bottom:8px">${titulo}</h3>
      <p style="font-size:13px;color:#6b7280;margin-bottom:20px;line-height:1.5">${descricao}</p>
      ${
        btnLabel
          ? `<button onclick="${btnFn}" style="
        background:#10b981;color:#fff;border:none;border-radius:9px;
        padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;
        display:inline-flex;align-items:center;gap:6px;
      "><i class='fa-solid fa-plus'></i> ${btnLabel}</button>`
          : ""
      }
    </div>
  `;
}
