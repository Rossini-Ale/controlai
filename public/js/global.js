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

// Saudação dinâmica por horário
function saudacao() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia ☕";
  if (h >= 12 && h < 18) return "Boa tarde ☀️";
  return "Boa noite 🌙";
}

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
  // Aplica máscara de moeda
  aplicarMascaraMoeda(inputValor);
  document.getElementById("modal-rapido").classList.add("active");
  setTimeout(() => inputValor.focus(), 100);
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
