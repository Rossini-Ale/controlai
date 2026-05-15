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
    { href: "/perfil.html", icon: "fa-user", label: "Perfil" },
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
  return `
    <nav class="tab-bar">
      <a href="/dashboard.html" class="tab-item ${paginaAtiva === "Início" ? "active" : ""}">
        <i class="fa-solid fa-house"></i>
        Início
      </a>
      <a href="/lancamentos.html" class="tab-item ${paginaAtiva === "Lançamentos" ? "active" : ""}">
        <i class="fa-solid fa-right-left"></i>
        Lançar
      </a>
      <div class="tab-btn-central" onclick="abrirModalRapido()">
        <div class="tab-btn-central-inner">
          <i class="fa-solid fa-plus"></i>
        </div>
      </div>
      <a href="/cartoes.html" class="tab-item ${paginaAtiva === "Cartões" ? "active" : ""}">
        <i class="fa-solid fa-credit-card"></i>
        Cartões
      </a>
      <button class="tab-item" onclick="toggleMais()">
        <i class="fa-solid fa-ellipsis"></i>
        Mais
      </button>
    </nav>

    <!-- Menu Mais -->
    <div class="mais-overlay" id="mais-overlay" onclick="fecharMais()"></div>
    <div class="mais-menu" id="mais-menu" style="display:none">
      <a href="/contas.html" class="mais-item">
        <i class="fa-solid fa-wallet"></i> Contas
      </a>
      <a href="/categorias.html" class="mais-item">
        <i class="fa-solid fa-tag"></i> Categorias
      </a>
      <a href="/metas.html" class="mais-item">
        <i class="fa-solid fa-bullseye"></i> Metas
      </a>
      <a href="/relatorios.html" class="mais-item">
        <i class="fa-solid fa-chart-bar"></i> Relatórios
      </a>
      <a href="/perfil.html" class="mais-item">
        <i class="fa-solid fa-user"></i> Perfil
      </a>
    </div>

    <!-- Modal lançamento rápido -->
    <div class="modal-rapido" id="modal-rapido">
      <div class="modal-rapido-inner">
        <h2>Novo lançamento</h2>
        <div class="tipo-toggle">
          <div class="tipo-btn active-despesa" id="tipo-despesa" onclick="selecionarTipo('despesa')">
            <i class="fa-solid fa-arrow-down" style="margin-right:4px"></i> Despesa
          </div>
          <div class="tipo-btn" id="tipo-receita" onclick="selecionarTipo('receita')">
            <i class="fa-solid fa-arrow-up" style="margin-right:4px"></i> Receita
          </div>
          <div class="tipo-btn" id="tipo-cartao" onclick="selecionarTipo('cartao')">
            <i class="fa-solid fa-credit-card" style="margin-right:4px"></i> Cartão
          </div>
        </div>
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px">Valor (R$)</label>
          <input type="number" id="r-valor" placeholder="0,00" step="0.01"
            style="width:100%;background:#0f1117;border:0.5px solid #2d3748;border-radius:9px;padding:12px 13px;color:#fff;font-size:18px;outline:none" />
        </div>
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px">Descrição</label>
          <input type="text" id="r-descricao" placeholder="Ex: Almoço, Mercado..."
            style="width:100%;background:#0f1117;border:0.5px solid #2d3748;border-radius:9px;padding:10px 13px;color:#fff;font-size:14px;outline:none" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div>
            <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px">Categoria</label>
            <select id="r-categoria" style="width:100%;background:#0f1117;border:0.5px solid #2d3748;border-radius:9px;padding:10px 13px;color:#fff;font-size:14px;outline:none"></select>
          </div>
          <div id="r-conta-wrap">
            <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.4px">Conta</label>
            <select id="r-conta" style="width:100%;background:#0f1117;border:0.5px solid #2d3748;border-radius:9px;padding:10px 13px;color:#fff;font-size:14px;outline:none"></select>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="fecharModalRapido()"
            style="flex:1;background:transparent;border:0.5px solid #2d3748;color:#9ca3af;border-radius:9px;padding:12px;font-size:14px;cursor:pointer">
            Cancelar
          </button>
          <button onclick="salvarRapido()"
            style="flex:2;background:#10b981;border:none;color:#fff;border-radius:9px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">
            Salvar
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── Menu Mais ──
function toggleMais() {
  const menu = document.getElementById("mais-menu");
  const overlay = document.getElementById("mais-overlay");
  const aberto = menu.style.display !== "none";
  menu.style.display = aberto ? "none" : "block";
  overlay.style.display = aberto ? "none" : "block";
  if (!aberto) overlay.classList.add("active");
  else overlay.classList.remove("active");
}

function fecharMais() {
  const menu = document.getElementById("mais-menu");
  const overlay = document.getElementById("mais-overlay");
  if (menu) menu.style.display = "none";
  if (overlay) overlay.style.display = "none";
  if (overlay) overlay.classList.remove("active");
}

// ── Lançamento rápido ──
let tipoRapido = "despesa";
let categoriasRapido = [];
let contasRapido = [];

async function abrirModalRapido() {
  categoriasRapido = (await fetchAPI("/api/categorias")) || [];
  contasRapido = (await fetchAPI("/api/contas")) || [];
  selecionarTipo("despesa");
  document.getElementById("r-valor").value = "";
  document.getElementById("r-descricao").value = "";
  document.getElementById("modal-rapido").classList.add("active");
  setTimeout(() => document.getElementById("r-valor").focus(), 100);
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

  const tipoCategoria = tipo === "receita" ? "receita" : "despesa";
  const filtradas = categoriasRapido.filter((c) => c.tipo === tipoCategoria);

  const selCat = document.getElementById("r-categoria");
  if (selCat) {
    selCat.innerHTML = filtradas.length
      ? filtradas
          .map((c) => `<option value="${c.id}">${c.nome}</option>`)
          .join("")
      : `<option value="">Sem categorias</option>`;
  }

  const selConta = document.getElementById("r-conta");
  if (selConta) {
    selConta.innerHTML = contasRapido.length
      ? contasRapido
          .map((c) => `<option value="${c.id}">${c.nome}</option>`)
          .join("")
      : `<option value="">Sem contas</option>`;
  }
}

async function salvarRapido() {
  const valor = parseFloat(document.getElementById("r-valor").value);
  const descricao = document.getElementById("r-descricao").value;
  const categoria = document.getElementById("r-categoria").value;
  const conta = document.getElementById("r-conta").value;
  const hoje = new Date().toISOString().split("T")[0];

  if (!valor || !descricao) {
    alert("Preencha valor e descrição.");
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
  if (typeof carregarCartoes === "function") carregarCartoes();
}
