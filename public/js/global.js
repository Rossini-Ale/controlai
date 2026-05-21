const API = "";
const PREFIX = "controlai_";

// ── Tema ──
function getTema() {
  return localStorage.getItem(PREFIX + "tema") || "auto";
}

function aplicarTema(tema) {
  document.documentElement.classList.remove("tema-claro", "tema-escuro");
  if (tema === "claro") document.documentElement.classList.add("tema-claro");
  if (tema === "escuro") document.documentElement.classList.add("tema-escuro");
  localStorage.setItem(PREFIX + "tema", tema);
  document.querySelectorAll(".btn-tema-icon").forEach((el) => {
    el.className = `fa-solid ${temaIcon(tema)} btn-tema-icon`;
  });
  document.querySelectorAll(".btn-tema-label").forEach((el) => {
    el.textContent = temaLabel(tema);
  });
}

function temaIcon(t) {
  if (t === "claro") return "fa-sun";
  if (t === "escuro") return "fa-moon";
  return "fa-circle-half-stroke";
}
function temaLabel(t) {
  if (t === "claro") return "Tema claro";
  if (t === "escuro") return "Tema escuro";
  return "Tema automático";
}
function toggleTema() {
  const atual = getTema();
  aplicarTema(
    atual === "escuro" ? "claro" : atual === "claro" ? "auto" : "escuro",
  );
}

// Aplica tema antes do render (evita flash)
aplicarTema(getTema());

// ── Animações de transição ──
function navegarPara(url) {
  const main = document.querySelector(".main");
  if (!main) {
    window.location.href = url;
    return;
  }
  main.classList.add("page-exit");
  setTimeout(() => {
    window.location.href = url;
  }, 180);
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.endsWith(".html") && !href.startsWith("http")) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        navegarPara(href);
      });
    }
  });
});

// ── Auth ──
function getToken() {
  return localStorage.getItem(PREFIX + "token");
}
function getNome() {
  return localStorage.getItem(PREFIX + "nome") || "Usuário";
}
function getUsername() {
  return localStorage.getItem(PREFIX + "username") || "";
}

// ── Saudação dinâmica por horário ──
function getSaudacao() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia ☕";
  if (h >= 12 && h < 18) return "Boa tarde ☀️";
  return "Boa noite 🌙";
}

function getPrimeiroNome() {
  return getNome().split(" ")[0];
}

function logout() {
  localStorage.removeItem(PREFIX + "token");
  localStorage.removeItem(PREFIX + "nome");
  localStorage.removeItem(PREFIX + "username");
  window.location.href = "/login.html";
}
function verificarAuth() {
  if (!getToken()) window.location.href = "/login.html";
}

// ── Helpers ──

// Formata moeda com centavos em contraste menor
// Retorna span com classe valor-privado para o modo privacidade
function formatarMoeda(valor) {
  const num = parseFloat(valor) || 0;
  const formatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
  // Separa centavos para aplicar contraste menor
  const match = formatado.match(/^(.*),(\d{2})$/);
  if (match) {
    return `<span class="valor-privado" style="font-variant-numeric:tabular-nums">${match[1]},<span style="opacity:0.55;font-size:0.8em">${match[2]}</span></span>`;
  }
  return `<span class="valor-privado" style="font-variant-numeric:tabular-nums">${formatado}</span>`;
}

// Versão sem wrapper — usar quando o valor vai dentro de atributos HTML ou JS puro
function formatarMoedaRaw(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(parseFloat(valor) || 0);
}

// Máscara de moeda em tempo real
function aplicarMascaraMoeda(input) {
  input.addEventListener("input", (e) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      e.target.value = "";
      return;
    }
    const numero = parseInt(raw, 10) / 100;
    // Guarda valor numérico como data attribute para leitura posterior
    e.target.dataset.valor = numero;
    e.target.value = numero.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  });
  // Ao focar, seleciona tudo para facilitar edição
  input.addEventListener("focus", () => setTimeout(() => input.select(), 10));
}

// Aplica máscara em múltiplos inputs por ID
function aplicarMascaraEmTodos(...ids) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) aplicarMascaraMoeda(el);
  });
}

// Lê o valor real de um input com máscara
function lerValorMoeda(input) {
  if (input.dataset.valor) return parseFloat(input.dataset.valor);
  const raw = input.value.replace(/\./g, "").replace(",", ".");
  return parseFloat(raw) || 0;
}

// Cor dinâmica no input de valor conforme tipo
function aplicarCorTipo(inputValor, tipo) {
  const cores = {
    despesa: { border: "#ef4444", bg: "rgba(239,68,68,0.06)" },
    receita: { border: "#10b981", bg: "rgba(16,185,129,0.06)" },
    cartao: { border: "#6366f1", bg: "rgba(99,102,241,0.06)" },
  };
  const c = cores[tipo] || cores.despesa;
  inputValor.style.borderColor = c.border;
  inputValor.style.background = c.bg;
  inputValor.style.transition = "border-color 0.2s, background 0.2s";
}

// ── Modo privacidade ──
const PRIV_KEY = "controlai_privacidade";

function getPrivacidade() {
  return localStorage.getItem(PRIV_KEY) === "1";
}

function aplicarPrivacidade() {
  const oculto = getPrivacidade();
  document.querySelectorAll(".valor-privado").forEach((el) => {
    el.style.filter = oculto ? "blur(7px)" : "none";
    el.style.userSelect = oculto ? "none" : "auto";
    el.style.transition = "filter 0.25s ease";
  });
  document.querySelectorAll(".priv-icon").forEach((el) => {
    el.className = `fa-solid ${oculto ? "fa-eye-slash" : "fa-eye"} priv-icon`;
  });
}

function togglePrivacidade() {
  localStorage.setItem(PRIV_KEY, getPrivacidade() ? "0" : "1");
  aplicarPrivacidade();
  const label = document.getElementById("priv-label");
  if (label) label.textContent = getPrivacidade() ? "Ocultos" : "Visíveis";
}

// Aplica ao carregar + observa mudanças no DOM
// (cobre valores injetados via fetchAPI após o carregamento inicial)
document.addEventListener("DOMContentLoaded", () => {
  aplicarPrivacidade();
  if (getPrivacidade()) {
    new MutationObserver(() => aplicarPrivacidade()).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
});

function formatarData(data) {
  if (!data) return "—";
  const d = new Date(data);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
function getMesAno() {
  const a = new Date();
  return { mes: a.getMonth() + 1, ano: a.getFullYear() };
}
function nomeMes(mes) {
  return [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ][mes - 1];
}
async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    return null;
  }
  return res.json();
}

// ════════════════════════════════════════
// SIDEBAR — desktop (4 itens)
// ════════════════════════════════════════
function renderSidebar(paginaAtiva) {
  const nome = getNome();
  const iniciais = nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const navItems = [
    { href: "/dashboard.html", icon: "fa-house", label: "Dashboard" },
    { href: "/lancamentos.html", icon: "fa-right-left", label: "Lançamentos" },
    { href: "/contas.html", icon: "fa-wallet", label: "Contas" },
    { href: "/relatorios.html", icon: "fa-chart-bar", label: "Relatórios" },
  ];
  return `
    <div class="sidebar-logo">
      <div class="icon"><i class="fa-solid fa-chart-pie"></i></div>
      <span>controlaí</span>
    </div>
    ${
      paginaAtiva === "Dashboard"
        ? `
    <div style="padding:12px 20px 4px;font-size:13px;color:var(--text-secondary)">
      ${getSaudacao()}, <strong style="color:var(--text-primary)">${getPrimeiroNome()}</strong>
    </div>`
        : ""
    }
    <nav>
      ${navItems
        .map(
          (item) => `
        <a href="${item.href}" class="nav-item ${paginaAtiva === item.label ? "active" : ""}">
          <i class="fa-solid ${item.icon}"></i> ${item.label}
        </a>`,
        )
        .join("")}
    </nav>
    <div class="sidebar-bottom">
      <div class="user-info" style="cursor:pointer" onclick="togglePerfilDesktop()" title="Perfil">
        <div class="user-avatar">${iniciais}</div>
        <div style="flex:1">
          <div class="user-name">${nome}</div>
          <div style="font-size:11px;color:var(--green)">Ver perfil</div>
        </div>
        <i class="fa-solid fa-chevron-up" id="chevron-perfil" style="color:var(--text-muted);font-size:12px;transition:transform 0.2s"></i>
      </div>
      <!-- Dropdown perfil desktop -->
      <div id="perfil-desktop-menu" style="display:none;margin-top:8px;background:var(--bg-tertiary);border-radius:10px;overflow:hidden;border:0.5px solid var(--border)">
        <a href="/configuracoes.html?aba=perfil" class="nav-item" style="padding:10px 14px;font-size:13px">
          <i class="fa-solid fa-pen"></i> Editar perfil
        </a>
        <a href="/configuracoes.html?aba=perfil" class="nav-item" style="padding:10px 14px;font-size:13px">
          <i class="fa-brands fa-telegram"></i> Telegram
        </a>
      </div>
      <button class="btn-tema" onclick="toggleTema()" style="margin-top:8px">
        <i class="fa-solid ${temaIcon(getTema())} btn-tema-icon"></i>
        <span class="btn-tema-label">${temaLabel(getTema())}</span>
      </button>
      <button class="btn-logout" onclick="logout()">
        <i class="fa-solid fa-right-from-bracket"></i> Sair
      </button>
    </div>`;
}

function togglePerfilDesktop() {
  const menu = document.getElementById("perfil-desktop-menu");
  const chevron = document.getElementById("chevron-perfil");
  if (!menu) return;
  const aberto = menu.style.display !== "none";
  menu.style.display = aberto ? "none" : "block";
  if (chevron) chevron.style.transform = aberto ? "" : "rotate(180deg)";
}

// ════════════════════════════════════════
// HEADER MOBILE — topo fixo
// ════════════════════════════════════════
function renderMobileHeader(paginaAtiva) {
  const nome = getNome();
  const iniciais = nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const titulo =
    paginaAtiva === "Dashboard"
      ? `<span style="font-size:13px">${getSaudacao()}, <strong>${getPrimeiroNome()}</strong></span>`
      : `<span class="mobile-header-title">${paginaAtiva}</span>`;
  return `
    <header class="mobile-header">
      <button class="mobile-avatar-btn" onclick="togglePerfilMenu()" aria-label="Perfil">
        ${iniciais}
      </button>
      ${titulo}
      <div class="mobile-header-actions">
        <button class="mobile-icon-btn" onclick="toggleTema()" aria-label="Alternar tema">
          <i class="fa-solid ${temaIcon(getTema())} btn-tema-icon"></i>
        </button>
        <button class="mobile-icon-btn" onclick="logout()" aria-label="Sair">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </header>

    <div class="perfil-overlay" id="perfil-overlay" onclick="fecharPerfilMenu()"></div>
    <div class="perfil-menu" id="perfil-menu">
      <!-- Toggle tema -->
      <button class="perfil-menu-item" onclick="toggleTema()">
        <i class="fa-solid ${temaIcon(getTema())} btn-tema-icon"></i>
        <span class="btn-tema-label">${temaLabel(getTema())}</span>
      </button>
      <div class="perfil-menu-divider"></div>
      <!-- Usuário -->
      <div class="perfil-menu-user">
        <div class="perfil-menu-avatar">${iniciais}</div>
        <div>
          <div class="perfil-menu-nome">${nome}</div>
          <a href="/configuracoes.html?aba=perfil" class="perfil-menu-link" onclick="fecharPerfilMenu()">Editar perfil</a>
        </div>
      </div>
      <div class="perfil-menu-divider"></div>
      <!-- Telegram -->
      <a href="/configuracoes.html?aba=perfil" class="perfil-menu-item" onclick="fecharPerfilMenu()" style="text-decoration:none">
        <i class="fa-brands fa-telegram" style="color:#229ED9"></i>
        <span>Conectar Telegram</span>
      </a>
      <div class="perfil-menu-divider"></div>
      <!-- Sair -->
      <button class="perfil-menu-item perfil-sair" onclick="logout()">
        <i class="fa-solid fa-right-from-bracket"></i>
        <span>Sair</span>
      </button>
    </div>`;
}

function togglePerfilMenu() {
  const menu = document.getElementById("perfil-menu");
  const overlay = document.getElementById("perfil-overlay");
  if (!menu) return;
  const aberto = menu.classList.contains("active");
  menu.classList.toggle("active", !aberto);
  overlay.classList.toggle("active", !aberto);
}
function fecharPerfilMenu() {
  document.getElementById("perfil-menu")?.classList.remove("active");
  document.getElementById("perfil-overlay")?.classList.remove("active");
}

// ════════════════════════════════════════
// TAB BAR — bottom mobile
// Início | Lançar | + | Contas | Relatórios
// ════════════════════════════════════════
function renderTabBar(paginaAtiva) {
  const tabs = [
    {
      href: "/dashboard.html",
      icon: "fa-house",
      label: "Início",
      page: "Dashboard",
    },
    {
      href: "/lancamentos.html",
      icon: "fa-right-left",
      label: "Lançar",
      page: "Lançamentos",
    },
    { central: true },
    {
      href: "/contas.html",
      icon: "fa-wallet",
      label: "Contas",
      page: "Contas",
    },
    {
      href: "/relatorios.html",
      icon: "fa-chart-bar",
      label: "Relatórios",
      page: "Relatórios",
    },
  ];

  const tabsHtml = tabs
    .map((t) => {
      if (t.central)
        return `
      <div class="tab-btn-central" onclick="abrirModalRapido()">
        <div class="tab-btn-central-inner"><i class="fa-solid fa-plus"></i></div>
      </div>`;
      return `
      <a href="${t.href}" class="tab-item ${paginaAtiva === t.page ? "active" : ""}">
        <i class="fa-solid ${t.icon}"></i>${t.label}
      </a>`;
    })
    .join("");

  return `
    <nav class="tab-bar">${tabsHtml}</nav>

    <div class="modal-rapido" id="modal-rapido">
      <div class="modal-rapido-inner">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2 style="margin:0">Novo lançamento</h2>
          <button onclick="fecharModalRapido()"
            style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="tipo-toggle">
          <div class="tipo-btn active-despesa" id="tipo-despesa" onclick="selecionarTipo('despesa')">
            <i class="fa-solid fa-arrow-down" style="margin-right:4px"></i>Despesa
          </div>
          <div class="tipo-btn" id="tipo-receita" onclick="selecionarTipo('receita')">
            <i class="fa-solid fa-arrow-up" style="margin-right:4px"></i>Receita
          </div>
          <div class="tipo-btn" id="tipo-cartao" onclick="selecionarTipo('cartao')">
            <i class="fa-solid fa-credit-card" style="margin-right:4px"></i>Cartão
          </div>
        </div>
        <div class="form-group">
          <label>Valor (R$)</label>
          <input type="text" inputmode="decimal" id="r-valor" placeholder="0,00"
            style="font-size:20px;font-weight:600;padding:14px 13px;transition:border-color 0.2s,background 0.2s" />
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <input type="text" id="r-descricao" placeholder="Ex: Almoço, Mercado..." />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group"><label>Categoria</label><select id="r-categoria"></select></div>
          <div class="form-group"><label>Conta</label><select id="r-conta"></select></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px">
          <button onclick="fecharModalRapido()" class="btn-cancel" style="flex:1;padding:12px">Cancelar</button>
          <button onclick="salvarRapido()" class="btn" style="flex:2;justify-content:center;padding:12px">Salvar</button>
        </div>
      </div>
    </div>`;
}

// Mantidos por compatibilidade
function toggleMais() {}
function fecharMais() {}

// ── Modal rápido ──
let tipoRapido = "despesa",
  categoriasRapido = [],
  contasRapido = [];

async function abrirModalRapido() {
  categoriasRapido = (await fetchAPI("/api/categorias")) || [];
  contasRapido = (await fetchAPI("/api/contas")) || [];
  selecionarTipo("despesa");
  const inputValor = document.getElementById("r-valor");
  inputValor.value = "";
  delete inputValor.dataset.valor;
  document.getElementById("r-descricao").value = "";
  aplicarMascaraMoeda(inputValor);
  // Remove chips anteriores para não duplicar
  document.getElementById("qa-r-valor")?.remove();
  document.getElementById("modal-rapido").classList.add("active");
  setTimeout(() => {
    inputValor.focus();
    renderQuickAmounts("r-valor", [10, 20, 50, 100, 200]);
    ativarInputCalculator("r-valor");
    ativarPullToDismiss("modal-rapido", fecharModalRapido);
    construirMapaCategoria();
  }, 100);
  // Categoria inteligente
  const inputDesc = document.getElementById("r-descricao");
  if (inputDesc) {
    inputDesc.oninput = (e) => {
      if (e.target.value.length >= 3)
        sugerirCategoria(e.target.value, "r-categoria");
    };
  }
}
function fecharModalRapido() {
  document.getElementById("modal-rapido").classList.remove("active");
}
function selecionarTipo(tipo) {
  tipoRapido = tipo;
  ["despesa", "receita", "cartao"].forEach((t) => {
    const btn = document.getElementById(`tipo-${t}`);
    if (btn) btn.className = `tipo-btn${tipo === t ? ` active-${t}` : ""}`;
  });
  // Cor dinâmica no input de valor
  const inputValor = document.getElementById("r-valor");
  if (inputValor) aplicarCorTipo(inputValor, tipo);

  const tc = tipo === "receita" ? "receita" : "despesa";
  const filtradas = categoriasRapido.filter((c) => c.tipo === tc);
  const selCat = document.getElementById("r-categoria");
  if (selCat)
    selCat.innerHTML = filtradas.length
      ? filtradas
          .map((c) => `<option value="${c.id}">${c.nome}</option>`)
          .join("")
      : `<option value="">Sem categorias</option>`;
  const selConta = document.getElementById("r-conta");
  if (selConta)
    selConta.innerHTML = contasRapido.length
      ? contasRapido
          .map((c) => `<option value="${c.id}">${c.nome}</option>`)
          .join("")
      : `<option value="">Sem contas</option>`;
}
async function salvarRapido() {
  const inputValor = document.getElementById("r-valor");
  const valor = lerValorMoeda(inputValor);
  const descricao = document.getElementById("r-descricao").value;
  const categoria = document.getElementById("r-categoria").value;
  const conta = document.getElementById("r-conta").value;
  const hoje = new Date().toISOString().split("T")[0];
  if (!valor || !descricao) {
    toast("Preencha valor e descrição.", "erro");
    return;
  }
  if (tipoRapido === "cartao") {
    const cartoes = (await fetchAPI("/api/cartoes")) || [];
    if (cartoes.length === 0) {
      alert("Nenhum cartão cadastrado.");
      return;
    }
    await fetchAPI(`/api/faturas/${cartoes[0].id}/lancar`, {
      method: "POST",
      body: JSON.stringify({
        descricao,
        valor,
        categoria_id: categoria,
        data: hoje,
        parcelas: 1,
      }),
    });
  } else {
    await fetchAPI("/api/transacoes", {
      method: "POST",
      body: JSON.stringify({
        tipo: tipoRapido,
        descricao,
        valor,
        categoria_id: categoria,
        conta_id: conta,
        data: hoje,
      }),
    });
  }
  fecharModalRapido();
  if (typeof carregarDados === "function") carregarDados();
  if (typeof carregarTransacoes === "function") carregarTransacoes();
  if (typeof carregarContas === "function") carregarContas();
}

// ════════════════════════════════════════
// ATALHOS DE TECLADO GLOBAIS
// ════════════════════════════════════════
document.addEventListener("keydown", (e) => {
  // Ignora se o foco estiver em input, select, textarea ou contenteditable
  const tag = document.activeElement?.tagName?.toLowerCase();
  const editavel =
    ["input", "select", "textarea"].includes(tag) ||
    document.activeElement?.isContentEditable;

  // ESC — fecha qualquer modal aberto
  if (e.key === "Escape") {
    const modaisAbertos = document.querySelectorAll(
      ".modal-overlay.active, .modal-rapido.active",
    );
    if (modaisAbertos.length > 0) {
      modaisAbertos.forEach((m) => m.classList.remove("active"));
      // Fecha também menus de perfil
      fecharPerfilMenu?.();
      e.preventDefault();
      return;
    }
  }

  // Ignora demais atalhos se estiver digitando
  if (editavel) return;

  // N — novo lançamento
  if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    if (typeof abrirModalLancamento === "function") abrirModalLancamento();
    else if (typeof abrirModalRapido === "function") abrirModalRapido();
    return;
  }

  // S — foca na busca (dashboard)
  if (e.key === "s" || e.key === "S") {
    const busca = document.getElementById("busca-input");
    if (busca) {
      e.preventDefault();
      busca.focus();
      busca.select();
    }
    return;
  }

  // ← → — navega entre meses (dashboard e lançamentos)
  if (e.key === "ArrowLeft" && typeof mudarMes === "function") {
    e.preventDefault();
    mudarMes(-1);
  }
  if (e.key === "ArrowRight" && typeof mudarMes === "function") {
    e.preventDefault();
    mudarMes(1);
  }
});

// ════════════════════════════════════════
// INPUT CALCULATOR
// Detecta expressões matemáticas no campo de valor
// Ex: "15,50 + 4,20" → "19,70"
// ════════════════════════════════════════
function ativarInputCalculator(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("blur", () => {
    const raw = input.value.trim();
    // Só processa se tiver operador matemático
    if (!/[+\-*/]/.test(raw)) return;

    try {
      // Converte formato BR para JS: "15,50 + 4,20" → "15.50 + 4.20"
      const expr = raw
        .replace(/[^\d.,+\-*/\s()]/g, "") // remove chars inválidos
        .replace(/,/g, ".") // vírgula → ponto
        .replace(/\.\./g, "."); // remove pontos duplos

      // Valida que é só números e operadores (sem eval de código)
      if (!/^[\d\s.+\-*/()]+$/.test(expr)) return;

      // eslint-disable-next-line no-new-func
      const resultado = Function(`"use strict"; return (${expr})`)();
      if (!isFinite(resultado) || resultado < 0) return;

      // Aplica o resultado com máscara
      const arredondado = Math.round(resultado * 100) / 100;
      input.value = arredondado.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      });
      input.dataset.valor = arredondado;

      // Feedback visual sutil
      input.style.borderColor = "var(--green)";
      input.style.transition = "border-color 0.3s";
      setTimeout(() => (input.style.borderColor = ""), 1200);
    } catch {
      /* ignora expressões inválidas */
    }
  });
}

// ════════════════════════════════════════
// OPTIMISTIC UI — remove elemento da tela
// antes da resposta do servidor
// ════════════════════════════════════════
function optimisticDelete(elementId, apiFn, onError) {
  const el = document.getElementById(elementId);
  if (!el) {
    apiFn();
    return;
  }

  // Salva snapshot para restaurar se falhar
  const parent = el.parentNode;
  const nextSibling = el.nextSibling;
  const clone = el.cloneNode(true);

  // Remove imediatamente com animação
  el.style.transition =
    "max-height 0.3s ease, opacity 0.25s ease, margin 0.3s ease";
  el.style.maxHeight = el.offsetHeight + "px";
  el.style.overflow = "hidden";
  el.style.opacity = "0";
  requestAnimationFrame(() => {
    el.style.maxHeight = "0";
    el.style.marginBottom = "0";
  });

  setTimeout(async () => {
    el.remove();
    try {
      await apiFn();
      haptic(8);
    } catch {
      // Falhou — restaura o elemento
      if (nextSibling) parent.insertBefore(clone, nextSibling);
      else parent.appendChild(clone);
      clone.style.cssText = "";
      toast("Não foi possível deletar. Tente novamente.", "erro");
      onError?.();
    }
  }, 280);
}

// ════════════════════════════════════════
// LONG-PRESS — menu de ações ao segurar
// ════════════════════════════════════════
let _longPressTimer = null;
let _longPressActive = false;

function ativarLongPress(elementId, acoes) {
  // acoes = [{ label, icon, cor, fn }, ...]
  const el = document.getElementById(elementId);
  if (!el) return;

  const DELAY = 500;

  function iniciar(e) {
    _longPressActive = false;
    _longPressTimer = setTimeout(() => {
      _longPressActive = true;
      haptic(20);
      abrirLongPressMenu(acoes, e.touches?.[0] || e);
    }, DELAY);
  }

  function cancelar() {
    clearTimeout(_longPressTimer);
  }

  el.addEventListener("touchstart", iniciar, { passive: true });
  el.addEventListener("touchmove", cancelar, { passive: true });
  el.addEventListener("touchend", cancelar);
  el.addEventListener("mousedown", iniciar);
  el.addEventListener("mousemove", cancelar);
  el.addEventListener("mouseup", cancelar);
}

function abrirLongPressMenu(acoes, event) {
  // Remove menu anterior se existir
  document.getElementById("long-press-menu")?.remove();
  document.getElementById("long-press-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "long-press-overlay";
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9990;
    animation:backdropIn 0.2s ease;backdrop-filter:blur(2px);
  `;
  overlay.onclick = () => {
    overlay.remove();
    document.getElementById("long-press-menu")?.remove();
  };

  const menu = document.createElement("div");
  menu.id = "long-press-menu";
  menu.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;
    background:var(--bg-secondary);
    border-radius:20px 20px 0 0;
    border-top:0.5px solid var(--border);
    padding:16px 16px 32px;
    z-index:9991;
    animation:slideUpMenu 0.25s cubic-bezier(0.34,1.56,0.64,1);
    box-shadow:0 -4px 24px rgba(0,0,0,0.2);
  `;

  // Injetar animação se não existir
  if (!document.getElementById("lp-style")) {
    const s = document.createElement("style");
    s.id = "lp-style";
    s.textContent = `
      @keyframes slideUpMenu {
        from { transform: translateY(100%); opacity:0; }
        to   { transform: translateY(0);    opacity:1; }
      }
    `;
    document.head.appendChild(s);
  }

  // Handle de arrasto
  menu.innerHTML = `
    <div style="width:36px;height:4px;background:var(--border);border-radius:99px;margin:0 auto 16px"></div>
    ${acoes
      .map(
        (a) => `
      <button onclick="(${a.fn.toString()})();document.getElementById('long-press-menu')?.remove();document.getElementById('long-press-overlay')?.remove();"
        style="
          width:100%;display:flex;align-items:center;gap:14px;
          background:transparent;border:none;padding:14px 8px;
          color:${a.cor || "var(--text-primary)"};font-size:15px;font-weight:500;
          cursor:pointer;border-radius:10px;transition:background 0.15s;text-align:left;
        "
        onmouseenter="this.style.background='var(--bg-tertiary)'"
        onmouseleave="this.style.background='transparent'"
      >
        <div style="width:36px;height:36px;border-radius:50%;background:${a.cor ? a.cor + "22" : "var(--bg-tertiary)"};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fa-solid ${a.icon}" style="font-size:15px"></i>
        </div>
        ${a.label}
      </button>
    `,
      )
      .join("")}
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(menu);
}

// ════════════════════════════════════════
// AUTO-SCROLL DE FOCO EM FORMULÁRIOS
// Centraliza o campo ativo na tela no mobile
// ════════════════════════════════════════
function ativarAutoScrollFoco(formSelector) {
  const form = document.querySelector(formSelector);
  if (!form || window.innerWidth > 768) return;

  form.querySelectorAll("input, select, textarea").forEach((el) => {
    el.addEventListener("focus", () => {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 320); // aguarda o teclado abrir (~300ms)
    });
  });
}

// ════════════════════════════════════════
// SMART AUTOCOMPLETE DE DESCRIÇÕES
// Mostra chips com as descrições mais usadas
// ════════════════════════════════════════
async function renderSmartDescricoes(inputDescId, inputCatId, containerId) {
  if (!_mapaCategoria) await construirMapaCategoria();

  // Remove chips anteriores
  document.getElementById(containerId)?.remove();
  const inputDesc = document.getElementById(inputDescId);
  if (!inputDesc) return;

  // Constrói mapa de frequência de descrições
  const freqDesc = {};
  const catPorDesc = {};
  try {
    const res = await fetchAPI("/api/transacoes?limit=200");
    const data = Array.isArray(res) ? res : res?.data || [];
    data.forEach((t) => {
      if (!t.descricao) return;
      const key = t.descricao.trim();
      freqDesc[key] = (freqDesc[key] || 0) + 1;
      catPorDesc[key] = t.categoria_id; // última categoria usada
    });
  } catch {
    return;
  }

  // Top 5 mais frequentes
  const tops = Object.entries(freqDesc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([desc]) => desc);

  if (tops.length === 0) return;

  const wrap = document.createElement("div");
  wrap.id = containerId;
  wrap.style.cssText = `
    display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;
    margin-bottom:10px;padding-bottom:2px;
    scrollbar-width:none;-webkit-overflow-scrolling:touch;
  `;
  wrap.style.setProperty("scrollbar-width", "none");

  tops.forEach((desc) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.style.cssText = `
      background:var(--bg-tertiary);border:0.5px solid var(--border);
      color:var(--text-secondary);border-radius:20px;
      padding:5px 12px;font-size:12px;cursor:pointer;
      white-space:nowrap;transition:all 0.15s;flex-shrink:0;
    `;
    chip.textContent = desc;
    chip.onmouseenter = () => {
      chip.style.borderColor = "var(--green)";
      chip.style.color = "var(--green)";
    };
    chip.onmouseleave = () => {
      chip.style.borderColor = "var(--border)";
      chip.style.color = "var(--text-secondary)";
    };
    chip.onclick = () => {
      inputDesc.value = desc;
      // Preenche categoria automaticamente
      if (catPorDesc[desc] && inputCatId) {
        const sel = document.getElementById(inputCatId);
        if (sel) {
          sel.value = catPorDesc[desc];
          // Feedback visual
          sel.style.borderColor = "var(--green)";
          setTimeout(() => (sel.style.borderColor = ""), 1200);
        }
      }
      wrap.remove();
      // Foca no próximo campo
      document.getElementById("f-valor")?.focus?.();
    };
    wrap.appendChild(chip);
  });

  // Insere antes do input de descrição
  inputDesc.parentNode.insertBefore(wrap, inputDesc);
}

// ════════════════════════════════════════
// CONFETE DE META BATIDA 🎉
// ════════════════════════════════════════
function dispararConfete() {
  const CORES = [
    "#10b981",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
  ];
  const TOTAL = 80;
  const container = document.createElement("div");
  container.style.cssText = `
    position:fixed;inset:0;pointer-events:none;z-index:9998;overflow:hidden;
  `;
  document.body.appendChild(container);

  for (let i = 0; i < TOTAL; i++) {
    const el = document.createElement("div");
    const cor = CORES[Math.floor(Math.random() * CORES.length)];
    const x = Math.random() * 100; // posição horizontal %
    const rot = Math.random() * 720 - 360; // rotação final
    const dur = 1200 + Math.random() * 800; // duração ms
    const tam = 6 + Math.random() * 8; // tamanho px
    const del = Math.random() * 400; // delay ms

    el.style.cssText = `
      position:absolute;
      left:${x}%;top:-10px;
      width:${tam}px;height:${tam * (Math.random() > 0.5 ? 1 : 2.5)}px;
      background:${cor};
      border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      opacity:1;
      animation:confete-cair ${dur}ms ease-in ${del}ms forwards;
    `;
    container.appendChild(el);
  }

  // Injeta keyframes uma vez
  if (!document.getElementById("confete-style")) {
    const s = document.createElement("style");
    s.id = "confete-style";
    s.textContent = `
      @keyframes confete-cair {
        0%   { transform: translateY(0)     rotate(0deg);    opacity:1; }
        80%  { opacity:1; }
        100% { transform: translateY(110vh) rotate(var(--rot,360deg)); opacity:0; }
      }
    `;
    document.head.appendChild(s);
  }

  // Aplica rotação via CSS custom property
  container.querySelectorAll("div").forEach((el) => {
    const rot = Math.random() * 720 - 360;
    el.style.setProperty("--rot", `${rot}deg`);
  });

  // Remove após animação
  setTimeout(() => container.remove(), 2500);

  // Háptico de celebração
  if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}
(function () {
  let banner = null;

  function criarBanner() {
    if (banner) return;
    banner = document.createElement("div");
    banner.className = "offline-banner";
    banner.innerHTML = `<i class="fa-solid fa-wifi-slash"></i> Você está offline. Suas ações serão pausadas até a conexão voltar.`;
    document.body.appendChild(banner);
  }

  function mostrarOffline() {
    criarBanner();
    requestAnimationFrame(() => banner.classList.add("visivel"));
    // Desabilita botões de salvar
    document
      .querySelectorAll(".btn[onclick*='salvar'], .btn[onclick*='Salvar']")
      .forEach((b) => {
        b.dataset.offlineDisabled = "1";
        b.disabled = true;
      });
  }

  function mostrarOnline() {
    if (banner) {
      banner.innerHTML = `<i class="fa-solid fa-wifi"></i> Conexão restaurada!`;
      banner.style.background = "#10b981";
      setTimeout(() => {
        banner.classList.remove("visivel");
        setTimeout(() => {
          banner?.remove();
          banner = null;
        }, 400);
      }, 2000);
    }
    // Reabilita botões
    document.querySelectorAll("[data-offline-disabled]").forEach((b) => {
      b.disabled = false;
      delete b.dataset.offlineDisabled;
    });
  }

  window.addEventListener("offline", mostrarOffline);
  window.addEventListener("online", mostrarOnline);
  if (!navigator.onLine) mostrarOffline();
})();

// ════════════════════════════════════════
// QUICK-AMOUNTS — chips de valor rápido
// ════════════════════════════════════════
function renderQuickAmounts(inputId, valores = [10, 50, 100, 200]) {
  const input = document.getElementById(inputId);
  if (!input || document.getElementById(`qa-${inputId}`)) return;

  const wrap = document.createElement("div");
  wrap.id = `qa-${inputId}`;
  wrap.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-top:6px";

  valores.forEach((v) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = formatarMoedaRaw(v);
    chip.style.cssText = `
      background: var(--bg-tertiary);
      border: 0.5px solid var(--border);
      color: var(--text-secondary);
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    `;
    chip.onmouseenter = () => {
      chip.style.borderColor = "var(--green)";
      chip.style.color = "var(--green)";
    };
    chip.onmouseleave = () => {
      chip.style.borderColor = "var(--border)";
      chip.style.color = "var(--text-secondary)";
    };
    chip.onclick = () => {
      // Aplica o valor no input com máscara
      input.value = v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
      input.dataset.valor = v;
      input.dispatchEvent(new Event("input")); // atualiza cor dinâmica
      input.focus();
    };
    wrap.appendChild(chip);
  });

  input.parentNode.appendChild(wrap);
}

// ════════════════════════════════════════
// CATEGORIA INTELIGENTE
// Sugere categoria baseada no histórico
// ════════════════════════════════════════
let _mapaCategoria = null; // cache em memória

async function construirMapaCategoria() {
  if (_mapaCategoria) return _mapaCategoria;
  try {
    const res = await fetchAPI("/api/transacoes?limit=200");
    const data = Array.isArray(res) ? res : res?.data || [];
    const mapa = {}; // { "uber": { catId: 3, count: 5 }, ... }
    data.forEach((t) => {
      if (!t.categoria_id || !t.descricao) return;
      const chave = t.descricao.toLowerCase().trim().split(" ")[0]; // primeira palavra
      if (!mapa[chave]) mapa[chave] = {};
      mapa[chave][t.categoria_id] = (mapa[chave][t.categoria_id] || 0) + 1;
    });
    _mapaCategoria = mapa;
    return mapa;
  } catch {
    return {};
  }
}

function sugerirCategoria(descricao, selectId) {
  if (!_mapaCategoria || !descricao) return;
  const chave = descricao.toLowerCase().trim().split(" ")[0];
  if (!_mapaCategoria[chave]) return;

  // Pega a categoria mais frequente para essa palavra
  const contagens = _mapaCategoria[chave];
  const melhorId = Object.entries(contagens).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  if (!melhorId) return;

  const sel = document.getElementById(selectId);
  if (!sel) return;

  // Só sugere se a opção existir e o usuário não tiver selecionado nada diferente
  const opcao = [...sel.options].find(
    (o) => String(o.value) === String(melhorId),
  );
  if (opcao) {
    sel.value = melhorId;
    // Feedback visual sutil
    sel.style.borderColor = "var(--green)";
    sel.style.transition = "border-color 0.3s";
    setTimeout(() => (sel.style.borderColor = ""), 1500);
  }
}

// ════════════════════════════════════════
// PULL-TO-DISMISS em modais bottom-sheet
// ════════════════════════════════════════
function ativarPullToDismiss(modalId, fecharFn) {
  const modal = document.querySelector(
    `#${modalId} .modal, #${modalId} .modal-rapido-inner`,
  );
  if (!modal) return;

  let startY = 0,
    currentY = 0,
    isDragging = false;
  const LIMIAR = 120; // pixels para fechar

  modal.addEventListener(
    "touchstart",
    (e) => {
      // Só ativa se o toque for no topo do modal (header)
      const rect = modal.getBoundingClientRect();
      const toqueY = e.touches[0].clientY;
      if (toqueY - rect.top > 60) return; // ignora se tocar longe do topo
      startY = e.touches[0].clientY;
      isDragging = true;
      modal.style.transition = "none";
    },
    { passive: true },
  );

  modal.addEventListener(
    "touchmove",
    (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const delta = Math.max(0, currentY - startY); // só para baixo
      modal.style.transform = `translateY(${delta}px)`;
      modal.style.opacity = `${Math.max(0.5, 1 - delta / (LIMIAR * 2))}`;
    },
    { passive: true },
  );

  modal.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    const delta = currentY - startY;
    modal.style.transition = "transform 0.25s ease, opacity 0.25s ease";

    if (delta > LIMIAR) {
      // Fecha com animação
      modal.style.transform = "translateY(100%)";
      modal.style.opacity = "0";
      setTimeout(fecharFn, 220);
    } else {
      // Volta para posição original
      modal.style.transform = "";
      modal.style.opacity = "";
    }
  });
}

// ════════════════════════════════════════
// VISIBILIDADE — atualiza ao voltar para a aba
// ════════════════════════════════════════
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  // Atualiza saldo se a função existir na página atual
  if (typeof carregarDados === "function") carregarDados();
  else if (typeof carregarResumo === "function") carregarResumo();
  // Atualiza favicon com alertas
  atualizarFavicon();
});

// ════════════════════════════════════════
// FAVICON DINÂMICO
// Adiciona ponto vermelho se houver recorrentes vencendo
// ════════════════════════════════════════
async function atualizarFavicon() {
  try {
    const data = await fetchAPI("/api/recorrentes/vencendo?dias=0");
    const vencendoHoje = Array.isArray(data) ? data.length : 0;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");

    // Fundo verde arredondado (ícone base)
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.roundRect(0, 0, 32, 32, 8);
    ctx.fill();

    // Letra C
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C", 16, 17);

    // Ponto vermelho se tiver alertas
    if (vencendoHoje > 0) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(26, 6, 7, 0, Math.PI * 2);
      ctx.fill();
      // Número dentro do ponto
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText(vencendoHoje > 9 ? "9+" : String(vencendoHoje), 26, 6);
    }

    // Injeta no favicon
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

// Chama ao carregar
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(atualizarFavicon, 2000);
});

// ════════════════════════════════════════
// COPIAR PIX / CÓDIGO
// Detecta chave pix ou código em observação
// ════════════════════════════════════════
function renderBotaoCopiar(texto, containerId) {
  if (!texto || texto.trim().length < 5) return "";
  // Heurística: se parece pix ou código (email, CPF, chave aleatória, copia-e-cola)
  const parecePix = /[@.\-+/A-Za-z0-9]{8,}/.test(texto.trim());
  if (!parecePix) return "";

  const id = `copiar-${containerId}`;
  return `<button id="${id}" onclick="copiarTexto('${texto.replace(/'/g, "\\'")}','${id}')"
    style="
      background:rgba(59,130,246,0.12);border:0.5px solid var(--blue);
      color:var(--blue);border-radius:8px;padding:5px 12px;
      font-size:12px;font-weight:600;cursor:pointer;
      display:inline-flex;align-items:center;gap:6px;
      transition:all 0.2s;margin-top:6px;
    ">
    <i class="fa-solid fa-copy"></i> Copiar código
  </button>`;
}

async function copiarTexto(texto, btnId) {
  try {
    await navigator.clipboard.writeText(texto);
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Copiado! 🎉`;
      btn.style.background = "rgba(16,185,129,0.12)";
      btn.style.borderColor = "var(--green)";
      btn.style.color = "var(--green)";
      setTimeout(() => {
        btn.innerHTML = `<i class="fa-solid fa-copy"></i> Copiar código`;
        btn.style.background = "rgba(59,130,246,0.12)";
        btn.style.borderColor = "var(--blue)";
        btn.style.color = "var(--blue)";
      }, 2500);
    }
    haptic(10);
  } catch {
    toast("Não foi possível copiar. Tente manualmente.", "aviso");
  }
}
