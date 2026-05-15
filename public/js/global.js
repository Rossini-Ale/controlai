const API = "";
const PREFIX = "controlai_";

function getToken() {
  return localStorage.getItem(PREFIX + "token");
}

function getNome() {
  return localStorage.getItem(PREFIX + "nome") || "Usuário";
}

function getUsername() {
  return localStorage.getItem(PREFIX + "username") || "";
}

function logout() {
  localStorage.removeItem(PREFIX + "token");
  localStorage.removeItem(PREFIX + "nome");
  localStorage.removeItem(PREFIX + "username");
  window.location.href = "/login.html";
}

function verificarAuth() {
  if (!getToken()) {
    window.location.href = "/login.html";
  }
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

function formatarData(data) {
  if (!data) return "—";
  const d = new Date(data);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function getMesAno() {
  const agora = new Date();
  return {
    mes: agora.getMonth() + 1,
    ano: agora.getFullYear(),
  };
}

function nomeMes(mes) {
  const meses = [
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
  ];
  return meses[mes - 1];
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
    { href: "/cartoes.html", icon: "fa-credit-card", label: "Cartões" },
    { href: "/categorias.html", icon: "fa-tag", label: "Categorias" },
    { href: "/metas.html", icon: "fa-bullseye", label: "Metas" },
    { href: "/relatorios.html", icon: "fa-chart-bar", label: "Relatórios" },
  ];

  return `
    <div class="sidebar-logo">
      <div class="icon"><i class="fa-solid fa-chart-pie"></i></div>
      <span>controlaí</span>
    </div>
    <nav>
      ${navItems
        .map(
          (item) => `
        <a href="${item.href}" class="nav-item ${paginaAtiva === item.label ? "active" : ""}">
          <i class="fa-solid ${item.icon}"></i>
          ${item.label}
        </a>
      `,
        )
        .join("")}
    </nav>
    <div class="sidebar-bottom">
      <div class="user-info">
        <div class="user-avatar">${iniciais}</div>
        <span class="user-name">${nome}</span>
      </div>
      <button class="btn-logout" onclick="logout()">
        <i class="fa-solid fa-right-from-bracket"></i>
        Sair
      </button>
    </div>
  `;
}

function renderTabBar(paginaAtiva) {
  const tabs = [
    { href: "/dashboard.html", icon: "fa-house", label: "Início" },
    { href: "/lancamentos.html", icon: "fa-right-left", label: "Lançamentos" },
    { href: "/cartoes.html", icon: "fa-credit-card", label: "Cartões" },
    { href: "/contas.html", icon: "fa-wallet", label: "Contas" },
    { href: "/relatorios.html", icon: "fa-chart-bar", label: "Relatórios" },
  ];

  return `
    <nav class="tab-bar">
      ${tabs
        .map(
          (t) => `
        <a href="${t.href}" class="tab-item ${paginaAtiva === t.label ? "active" : ""}">
          <i class="fa-solid ${t.icon}"></i>
          ${t.label}
        </a>
      `,
        )
        .join("")}
    </nav>
  `;
}
