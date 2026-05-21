// ════════════════════════════════════════
// voice.js — Lançamento por voz
// Web Speech API pt-BR
// ════════════════════════════════════════

function ativarVoz(btnId, descId, valorId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    btn.style.display = "none";
    return;
  }

  const rec = new SR();
  rec.lang = "pt-BR";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  let ouvindo = false;

  btn.onclick = () => {
    if (ouvindo) {
      rec.stop();
      return;
    }
    ouvindo = true;
    btn.innerHTML = `<i class="fa-solid fa-circle" style="color:#ef4444"></i>`;
    btn.title = "Ouvindo... clique para parar";
    haptic(15);
    try {
      rec.start();
    } catch {
      ouvindo = false;
    }
  };

  rec.onresult = (e) => {
    const texto = e.results[0][0].transcript.toLowerCase().trim();

    // Extrai valor numérico
    const NUMS = {
      um: 1,
      dois: 2,
      tres: 3,
      três: 3,
      quatro: 4,
      cinco: 5,
      seis: 6,
      sete: 7,
      oito: 8,
      nove: 9,
      dez: 10,
      vinte: 20,
      trinta: 30,
      quarenta: 40,
      cinquenta: 50,
      sessenta: 60,
      setenta: 70,
      oitenta: 80,
      noventa: 90,
      cem: 100,
      cento: 100,
      duzentos: 200,
      trezentos: 300,
      quatrocentos: 400,
      quinhentos: 500,
      mil: 1000,
    };
    let valor = null;
    const matchNum = texto.match(/(\d+(?:[,\.]\d{1,2})?)/);
    if (matchNum) valor = parseFloat(matchNum[1].replace(",", "."));
    if (!valor) {
      for (const [p, n] of Object.entries(NUMS)) {
        if (texto.includes(p)) {
          valor = n;
          break;
        }
      }
    }

    // Extrai descrição
    let descricao = texto
      .replace(/\d+(?:[,\.]\d{1,2})?/g, "")
      .replace(/\b(reais?|real|r\$|pagar?|comprei?|gastei?)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);

    if (descricao) {
      const el = document.getElementById(descId);
      if (el) {
        el.value = descricao;
        el.dispatchEvent(new Event("input"));
      }
    }
    if (valor) {
      const el = document.getElementById(valorId);
      if (el) {
        el.value = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        el.dataset.valor = valor;
        el.dispatchEvent(new Event("input"));
      }
    }
    haptic(20);
    toast(
      `🎤 "${texto}"${valor ? " → " + formatarMoedaRaw(valor) : ""}`,
      "sucesso",
    );
  };

  rec.onend = () => {
    ouvindo = false;
    btn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;
    btn.title = "Lançar por voz";
  };

  rec.onerror = (e) => {
    ouvindo = false;
    btn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;
    if (e.error !== "no-speech")
      toast("Voz não reconhecida. Tente novamente.", "aviso");
  };
}
