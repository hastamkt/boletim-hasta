/* Boletim Hasta — renderização do dashboard a partir de data/boletim.json */
(function () {
  "use strict";
  var S1 = "#7a3a96", S2 = "#b07a00", GRADE = "#efefef", TXT2 = "#4a4a4a";
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  var SETORES = { geral: "Geral", frutas: "Frutas", legumes: "Legumes", verduras: "Verduras", diversos: "Diversos", pescados: "Pescados" };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function num(v, d) { if (v == null || isNaN(v)) return "–"; return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pct(v, d) { if (v == null) return "–"; d = d == null ? 2 : d; return (v > 0 ? "+" : "") + num(v, d) + "%"; }
  function seta(v) { return v == null ? "" : '<span class="seta" aria-hidden="true">' + (v > 0 ? "▲" : v < 0 ? "▼" : "■") + "</span>"; }
  function refMes(r) { if (!r) return ""; var p = String(r).split("-"); return MESES[+p[1] - 1] + "/" + p[0].slice(2); }
  function dataBR(s) { if (!s) return ""; var p = String(s).slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : s; }
  function compacto(v) { if (v >= 1e6) return num(v / 1e6, 1) + " mi"; if (v >= 1e3) return num(v / 1e3, 0) + " mil"; return num(v, 0); }

  /* tooltip compartilhado para listas/rankings */
  var tip = null;
  function ligarTip(node, html) {
    node.addEventListener("mousemove", function (e) { tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 250) + "px"; tip.style.top = (e.clientY + 14) + "px"; });
    node.addEventListener("mouseleave", function () { tip.hidden = true; });
  }

  function segmentado(container, opcoes, ativo, onChange) {
    container.innerHTML = "";
    opcoes.forEach(function (o) {
      var b = el("button", o.v === ativo ? "on" : "", o.t); b.dataset.v = o.v; b.type = "button";
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", o.v === ativo);
      b.onclick = function () { Array.prototype.forEach.call(container.children, function (c) { c.classList.remove("on"); c.setAttribute("aria-selected", "false"); }); b.classList.add("on"); b.setAttribute("aria-selected", "true"); onChange(o.v); };
      container.appendChild(b);
    });
  }
  function ligarSeg(container, onChange) {
    Array.prototype.forEach.call(container.children, function (b) {
      b.type = "button";
      b.onclick = function () { Array.prototype.forEach.call(container.children, function (c) { c.classList.remove("on"); }); b.classList.add("on"); onChange(b.dataset.v); };
    });
  }

  function kpi(o) {
    var k = el("div", "kpi" + (o.neutro ? " neutro" : ""));
    k.appendChild(el("div", "kpi-nome", o.nome));
    k.appendChild(el("div", "kpi-valor", o.valor));
    if (o.variacao) k.appendChild(el("div", "kpi-var", o.variacao));
    if (o.sub) k.appendChild(el("div", "kpi-sub", o.sub));
    if (o.spark && o.spark.length > 1 && window.Chart) {
      var c = el("canvas"); c.setAttribute("aria-hidden", "true"); k.appendChild(c);
      setTimeout(function () { sparkline(c, o.spark); }, 0);
    }
    return k;
  }
  function sparkline(canvas, pts) {
    new Chart(canvas, { type: "line", data: { labels: pts.map(function (p) { return dataBR(p[0]); }), datasets: [{ data: pts.map(function (p) { return p[1]; }), borderColor: "#4f1964", borderWidth: 2, pointRadius: 0, tension: .3 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } } });
  }

  function listaVar(container, itens, fmtNome) {
    container.innerHTML = "";
    var max = Math.max.apply(null, itens.map(function (i) { return Math.abs(i[1]); }).concat([0.01]));
    itens.forEach(function (i) {
      var l = el("div", "linha");
      l.appendChild(el("div", "nome", fmtNome ? fmtNome(i[0]) : i[0]));
      var b = el("div", "barra" + (i[1] < 0 ? " neg" : "")); var s = el("span"); s.style.width = (Math.abs(i[1]) / max * 100) + "%"; b.appendChild(s); l.appendChild(b);
      l.appendChild(el("div", "val", seta(i[1]) + pct(i[1])));
      ligarTip(l, "<b>" + i[0] + "</b><br>" + pct(i[1]));
      container.appendChild(l);
    });
  }

  function ranking(container, itens, fmt, opts) {
    opts = opts || {};
    container.innerHTML = "";
    var vals = itens.map(function (i) { return i.v; }).filter(function (v) { return v != null; });
    var max = Math.max.apply(null, vals), min = opts.base0 ? 0 : Math.min.apply(null, vals) * 0.9;
    itens.forEach(function (i, n) {
      var l = el("div", "linha");
      l.appendChild(el("div", "pos", (n + 1) + "º"));
      l.appendChild(el("div", "nome", "<b>" + i.uf + "</b>" + i.nome));
      var b = el("div", "barra"); var s = el("span"); s.style.width = i.v == null ? "0" : (Math.max(3, (i.v - min) / (max - min || 1) * 100)) + "%"; b.appendChild(s); l.appendChild(b);
      l.appendChild(el("div", "val", fmt(i.v, i)));
      ligarTip(l, "<b>" + i.nome + "</b><br>" + fmt(i.v, i) + (i.extra ? "<br>" + i.extra : ""));
      container.appendChild(l);
    });
  }

  function eixos(sufixo) {
    return {
      x: { grid: { display: false }, ticks: { color: TXT2, font: { family: "Inter", size: 11 } } },
      y: { grid: { color: GRADE }, border: { display: false }, ticks: { color: TXT2, font: { family: "Inter", size: 11 }, callback: function (v) { return num(v, 1) + (sufixo || ""); } } }
    };
  }
  var tooltipBase = { backgroundColor: "#fff", titleColor: "#111", bodyColor: "#111", borderColor: "#ececec", borderWidth: 1, padding: 10, titleFont: { family: "Inter", weight: "700" }, bodyFont: { family: "Montserrat" } };

  /* ---------------- Mercado ---------------- */
  function mercado(d) {
    var m = d.mercado; if (!m) return;
    $("ref-mercado").textContent = "Fechamento de " + dataBR(m.data);
    var box = $("kpis-mercado");
    m.ativos.forEach(function (a) {
      var dec = a.id === "ibovespa" || a.id === "bitcoin" ? 0 : (a.id === "dolar" || a.id === "euro" ? 4 : 2);
      var valor = a.unidade === "pts" ? num(a.valor, 0) + "<small>pts</small>" : "<small>" + a.unidade + "</small> " + num(a.valor, dec);
      var sub = [];
      if (a.var_mes != null) sub.push("mês " + pct(a.var_mes));
      if (a.var_ano != null) sub.push("ano " + pct(a.var_ano));
      if (a.var_12m != null) sub.push("12m " + pct(a.var_12m));
      if (a.extra) sub.push(a.extra);
      if (a.data && a.data !== m.data) sub.push("ref. " + dataBR(a.data));
      var card = kpi({ nome: a.nome, valor: valor, variacao: a.var_dia == null ? "último fechamento" : seta(a.var_dia) + pct(a.var_dia) + " no dia", sub: sub.join(" · "), spark: (a.hist || []).filter(function (p) { return p[1] != null; }) });
      card.dataset.ativo = a.id; box.appendChild(card);
    });
    $("ref-altas").textContent = $("ref-baixas").textContent = "Pregão de " + dataBR(m.data) + " · ações do índice";
    listaVar($("altas"), m.maiores_altas.map(function (x) { return [x.ticker + (x.nome ? " · " + x.nome : ""), x.var]; }));
    listaVar($("baixas"), m.maiores_baixas.map(function (x) { return [x.ticker + (x.nome ? " · " + x.nome : ""), x.var]; }));
  }

  /* ---------------- Juros e inflação ---------------- */
  var gInfl = null;
  function juros(d) {
    var box = $("kpis-juros");
    var s = d.juros && d.juros.selic;
    if (s) {
      var dif = s.anterior != null ? s.atual - s.anterior : null;
      box.appendChild(kpi({ nome: "Selic (meta)", valor: num(s.atual, 2) + "<small>% a.a.</small>", variacao: "Copom " + dataBR(s.decisao) + (s.resultado ? " · " + s.resultado : ""), sub: (s.proxima_reuniao ? "Próxima reunião: " + s.proxima_reuniao : "") + (dif ? " · " + (dif > 0 ? "+" : "") + num(dif, 2) + " p.p. vs. ciclo anterior" : ""), spark: s.hist }));
    }
    (d.inflacao || []).forEach(function (i) {
      box.appendChild(kpi({ nome: i.nome + " · " + refMes(i.ref), valor: pct(i.mes), variacao: "12 meses: " + pct(i.acum12) + (i.acum_ano != null ? " · ano: " + pct(i.acum_ano) : ""), sub: i.fonte + (i.prox ? " · próximo: " + i.prox : "") }));
    });
    var indices = (d.inflacao || []).map(function (i) { return { v: i.id, t: i.nome }; });
    var estado = { id: indices.length ? (d.inflacao.find(function (i) { return i.id === "igpm"; }) ? "igpm" : indices[0].v) : null, modo: "mes" };
    function desenhar() {
      var i = d.inflacao.find(function (x) { return x.id === estado.id; }); if (!i) return;
      var pts = (i.hist || []).filter(function (h) { return h[estado.modo] != null; });
      $("tit-infl").textContent = i.nome + " — " + (estado.modo === "mes" ? "variação mensal" : "acumulado em 12 meses");
      $("nota-infl").textContent = pts.length < 6 ? "Série curta nesta versão inicial; a atualização automática completa o histórico de 24 meses (Banco Central/SGS)." : "Fonte: " + i.fonte + " via Banco Central (SGS).";
      var cfg = {
        type: estado.modo === "mes" ? "bar" : "line",
        data: { labels: pts.map(function (h) { return refMes(h.ref); }), datasets: [{ label: i.nome, data: pts.map(function (h) { return h[estado.modo]; }),
          backgroundColor: pts.map(function (h) { return h[estado.modo] < 0 ? S2 : S1; }), borderColor: S1, borderWidth: estado.modo === "mes" ? 0 : 2, borderRadius: 4, borderSkipped: "start", pointRadius: estado.modo === "mes" ? 0 : 3, pointHoverRadius: 6, tension: .25, maxBarThickness: 26 }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: Object.assign({}, tooltipBase, { callbacks: { label: function (c) { return " " + pct(c.parsed.y); } } }) }, scales: eixos("%") }
      };
      if (gInfl) gInfl.destroy();
      gInfl = new Chart($("g-infl"), cfg);
    }
    segmentado($("sel-indice"), indices, estado.id, function (v) { estado.id = v; desenhar(); });
    ligarSeg($("sel-modo"), function (v) { estado.modo = v; desenhar(); });
    if (window.Chart) desenhar();
  }

  /* ---------------- Agro ---------------- */
  var gCea = null;
  function agro(d) {
    var c = d.ceagesp;
    if (c && c.meses && c.meses.length) {
      var ult = c.meses[c.meses.length - 1];
      $("ref-ceagesp").textContent = "Atacado de São Paulo · referência " + refMes(ult.ref) + " · variação no mês";
      var box = $("kpis-ceagesp");
      Object.keys(SETORES).forEach(function (k) {
        var ac = c.acumulado && c.acumulado[k];
        box.appendChild(kpi({ nome: SETORES[k], valor: pct(ult[k]), neutro: k !== "geral", variacao: seta(ult[k]) + "no mês", sub: ac ? "ano " + pct(ac.ano) + " · 12m " + pct(ac.m12) : "" }));
      });
      var setores = Object.keys(SETORES).filter(function (k) { return k !== "geral"; }).map(function (k) { return { v: k, t: SETORES[k] }; });
      var atual = "verduras";
      $("leg-ceagesp").innerHTML = '<span><i style="background:' + S1 + '"></i><span id="leg-s">Verduras</span></span><span><i style="background:' + S2 + '"></i>Índice geral</span>';
      function desenhar() {
        $("leg-s").textContent = SETORES[atual];
        var cfg = { type: "line", data: { labels: c.meses.map(function (m) { return refMes(m.ref); }), datasets: [
          { label: SETORES[atual], data: c.meses.map(function (m) { return m[atual]; }), borderColor: S1, backgroundColor: S1, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .25 },
          { label: "Geral", data: c.meses.map(function (m) { return m.geral; }), borderColor: S2, backgroundColor: S2, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .25, borderDash: [6, 4] }] },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: Object.assign({}, tooltipBase, { callbacks: { label: function (x) { return " " + x.dataset.label + ": " + pct(x.parsed.y); } } }) }, scales: eixos("%") } };
        if (gCea) gCea.destroy(); gCea = new Chart($("g-ceagesp"), cfg);
      }
      segmentado($("sel-setor"), setores, atual, function (v) { atual = v; desenhar(); });
      if (window.Chart) desenhar();
      if (c.destaques) {
        $("ref-dest").textContent = "Produtos com maior variação de preço em " + refMes(c.destaques.ref) + " (CEAGESP)";
        var s2 = "verduras";
        function dest() { var x = c.destaques.setores[s2] || { altas: [], quedas: [] }; listaVar($("dest-altas"), x.altas); listaVar($("dest-quedas"), x.quedas); }
        segmentado($("sel-setor2"), setores.filter(function (s) { return c.destaques.setores[s.v]; }), s2, function (v) { s2 = v; dest(); });
        dest();
      }
    }
    var t = $("t-cepea");
    if (d.cepea && d.cepea.length) {
      var h = "<thead><tr><th>Produto</th><th>Praça / indicador</th><th style='text-align:right'>Preço</th><th>Unidade</th><th>Data</th><th style='text-align:right'>Variação</th><th style='text-align:right'>vs. referência anterior</th></tr></thead><tbody>";
      d.cepea.forEach(function (r) {
        var ant = r.ant ? pct((r.valor / r.ant.valor - 1) * 100, 1) + " <span style='color:#767676;font-weight:500'>desde " + dataBR(r.ant.data) + "</span>" : "–";
        h += "<tr><td><b>" + r.produto + "</b></td><td>" + r.praca + "</td><td class='num'>" + num(r.valor, 2) + "</td><td>" + r.unidade + "</td><td>" + (String(r.data).length > 7 ? dataBR(r.data) : refMes(r.data)) + "</td><td class='num'>" + (r.var != null ? seta(r.var) + pct(r.var, 1) + " <span style='color:#767676;font-weight:500'>" + (r.periodo || "") + "</span>" : "–") + "</td><td class='num'>" + ant + "</td></tr>";
      });
      t.innerHTML = h + "</tbody>";
    }
  }

  /* ---------------- Combustíveis e energia ---------------- */
  function energia(d) {
    var c = d.combustiveis; if (!c) return;
    var b = c.brasil;
    $("ref-comb").textContent = "Médias de revenda ANP — Brasil: semana " + b.semana;
    var hist = c.hist_brasil || [];
    function serie(k) { return hist.filter(function (h) { return h[k] != null; }).map(function (h) { return [h.semana, h[k]]; }); }
    function varSem(k) { var s = serie(k); if (s.length < 2) return null; return (s[s.length - 1][1] / s[s.length - 2][1] - 1) * 100; }
    var box = $("kpis-comb");
    [["gasolina", "Gasolina comum", "/litro"], ["etanol", "Etanol hidratado", "/litro"], ["diesel_s10", "Diesel S10", "/litro"]].forEach(function (x) {
      var v = varSem(x[0]);
      box.appendChild(kpi({ nome: x[1], valor: "<small>R$</small> " + num(b[x[0]], 2), variacao: v != null ? seta(v) + pct(v) + " na semana" : "Média Brasil", sub: x[0] === "etanol" ? "Paridade com gasolina: " + num(b.etanol / b.gasolina * 100, 0) + "%" : "", spark: serie(x[0]) }));
    });
    box.appendChild(kpi({ nome: "Botijão GLP 13 kg", valor: "<small>R$</small> " + num(b.glp, 2), variacao: "Média Brasil", sub: b.glp_semana ? "Semana " + b.glp_semana : "", spark: serie("glp") }));
    var en = d.energia;
    if (en && en.distribuidoras) {
      var med = en.distribuidoras.reduce(function (a, x) { return a + x.tarifa; }, 0) / en.distribuidoras.length;
      box.appendChild(kpi({ nome: "Energia residencial", valor: "<small>R$</small> " + num(med, 3) + "<small>/kWh</small>", neutro: true, variacao: "Média simples das distribuidoras listadas", sub: en.media_b1_dez26_mwh ? "ANEEL projeta B1 médio de R$ " + en.media_b1_dez26_mwh + "/MWh em dez/26 (" + pct((en.media_b1_dez26_mwh / en.media_b1_dez25_mwh - 1) * 100, 1) + " vs dez/25), sem tributos" : "" }));
    }
    var prods = [{ v: "gasolina", t: "Gasolina" }, { v: "etanol", t: "Etanol" }, { v: "diesel_s10", t: "Diesel S10" }, { v: "glp", t: "Botijão GLP" }];
    function rank(p) {
      var itens = c.estados.map(function (e) { return { uf: e.uf, nome: e.nome, v: e[p], extra: p === "etanol" && e.gasolina ? "Paridade: " + num(e.etanol / e.gasolina * 100, 0) + "% da gasolina" : "" }; }).sort(function (a, b) { return (b.v || 0) - (a.v || 0); });
      $("ref-rank").textContent = "Do mais caro ao mais barato · semana " + (p === "glp" ? c.semana_glp_estados : c.semana) + (p === "glp" ? " (dado estadual mais recente da base inicial)" : "");
      ranking($("rank-comb"), itens, function (v) { return "R$ " + num(v, 2); });
    }
    segmentado($("sel-comb"), prods, "gasolina", rank); rank("gasolina");
    if (en && en.distribuidoras) {
      $("ref-energia").textContent = en.ref + " · R$/kWh sem impostos, bandeira verde · da mais cara à mais barata";
      var itens = en.distribuidoras.map(function (x) { return { uf: x.uf, nome: x.distribuidora, v: x.tarifa, extra: "Conta de 150 kWh ≈ R$ " + num(x.tarifa * 150, 2) + " (sem tributos)" }; }).sort(function (a, b) { return b.v - a.v; });
      ranking($("rank-energia"), itens, function (v) { return "R$ " + num(v, 3); });
    }
  }

  /* ---------------- IBGE ---------------- */
  function brasil(d) {
    var g = d.ibge; if (!g) return;
    var p = g.populacao, pib = g.pib_pc, box = $("kpis-ibge");
    if (p) box.appendChild(kpi({ nome: "População · " + p.ano, valor: num(p.brasil / 1e6, 1) + "<small>milhões</small>", variacao: p.brasil_ant ? seta(1) + pct((p.brasil / p.brasil_ant - 1) * 100) + " vs. ano anterior" : "", sub: "Estimativa IBGE em 1º de julho" }));
    if (pib) box.appendChild(kpi({ nome: "PIB per capita · " + pib.ano, valor: "<small>R$</small> " + num(pib.brasil, 0), variacao: "Média nacional", sub: "Contas Regionais IBGE" }));
    if (p) {
      var top = p.estados.slice().sort(function (a, b) { return b.pop - a.pop; })[0];
      box.appendChild(kpi({ nome: "Estado mais populoso", valor: top.uf, neutro: true, variacao: compacto(top.pop) + " hab.", sub: num(top.pop / p.brasil * 100, 1) + "% do país" }));
    }
    if (pib) {
      var t2 = pib.estados.slice().sort(function (a, b) { return b.valor - a.valor; });
      box.appendChild(kpi({ nome: "Maior PIB per capita", valor: t2[0].uf, neutro: true, variacao: "R$ " + num(t2[0].valor, 0), sub: num(t2[0].valor / pib.brasil, 1) + "× a média · menor: " + t2[t2.length - 1].uf }));
    }
    function desenhar(modo) {
      if (modo === "pop") {
        var itens = p.estados.map(function (e) { return { uf: e.uf, nome: e.nome, v: e.pop, extra: num(e.pop / p.brasil * 100, 2) + "% da população" }; }).sort(function (a, b) { return b.v - a.v; });
        ranking($("rank-ibge"), itens, function (v) { return compacto(v); }, { base0: true });
        $("nota-ibge").textContent = "Estimativas da População " + p.ano + " (IBGE).";
      } else {
        var it = pib.estados.map(function (e) { return { uf: e.uf, nome: e.nome, v: e.valor, aprox: e.aprox, extra: num(e.valor / pib.brasil, 2) + "× a média nacional" }; }).sort(function (a, b) { return b.v - a.v; });
        ranking($("rank-ibge"), it, function (v, i) { return (i && i.aprox ? "≈ " : "") + "R$ " + compacto(v); }, { base0: true });
        $("nota-ibge").textContent = "PIB per capita " + pib.ano + " (IBGE, Contas Regionais)." + (it.some(function (x) { return x.aprox; }) ? " Valores com ≈ foram derivados da razão UF/Brasil publicada pelo IBGE e são substituídos pelos exatos na próxima atualização automática." : "");
      }
    }
    ligarSeg($("sel-ibge"), desenhar); desenhar("pop");
  }

  /* ---------------- Municípios (IBGE ao vivo, por estado) ---------------- */
  var COD_UF = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 };
  var NOME_UF = { AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins" };
  var cacheMun = {};
  function ibgeSerie(agregado, variavel, periodo, uf) {
    var url = "https://servicodados.ibge.gov.br/api/v3/agregados/" + agregado + "/periodos/" + periodo + "/variaveis/" + variavel + "?localidades=N6[N3[" + COD_UF[uf] + "]]";
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var out = {}, ano = null;
      j[0].resultados[0].series.forEach(function (s) { var k = Object.keys(s.serie); ano = k[k.length - 1]; var v = parseFloat(s.serie[ano]); out[s.localidade.id] = { nome: s.localidade.nome.replace(/ - [A-Z]{2}$/, ""), v: isNaN(v) ? null : v }; });
      return { dados: out, ano: ano };
    });
  }
  function carregarMunicipios(uf) {
    if (cacheMun[uf]) return Promise.resolve(cacheMun[uf]);
    return Promise.all([ibgeSerie(6579, 9324, "-1", uf), ibgeSerie(6579, 9324, "2024", uf).catch(function () { return null; }), ibgeSerie(5938, 37, "-1", uf)]).then(function (r) {
      var pop = r[0], pop24 = r[1], pib = r[2], lista = [];
      Object.keys(pop.dados).forEach(function (id) {
        var p = pop.dados[id], b = pib.dados[id], base = pop24 && pop24.dados[id] ? pop24.dados[id].v : p.v;
        var pibR = b && b.v != null ? b.v * 1000 : null;
        lista.push({ nome: p.nome, pop: p.v, pib: pibR, pc: pibR && base ? pibR / base : null });
      });
      return (cacheMun[uf] = { lista: lista, anoPop: pop.ano, anoPib: pib.ano });
    });
  }
  function municipios() {
    var sel = $("mun-uf"), busca = $("mun-busca"), tab = $("t-mun"), st = $("mun-status"), res = $("mun-resumo");
    if (!sel) return;
    Object.keys(NOME_UF).sort(function (a, b) { return NOME_UF[a].localeCompare(NOME_UF[b]); }).forEach(function (uf) { var o = el("option"); o.value = uf; o.textContent = NOME_UF[uf]; sel.appendChild(o); });
    var atual = null, ordem = { k: "pop", dir: -1 };
    var cols = [["pos", "#"], ["nome", "Município"], ["pop", "Habitantes"], ["pib", "PIB (R$ mi)"], ["pc", "PIB per capita"]];
    function desenhar() {
      if (!atual) return;
      var termo = busca.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      var lista = atual.lista.slice().sort(function (a, b) { var x = a[ordem.k], y = b[ordem.k]; if (ordem.k === "nome") return x.localeCompare(y) * ordem.dir; return ((x == null ? -Infinity : x) - (y == null ? -Infinity : y)) * ordem.dir; });
      var rankPop = {}; atual.lista.slice().sort(function (a, b) { return b.pop - a.pop; }).forEach(function (m, i) { rankPop[m.nome] = i + 1; });
      var h = "<thead><tr>" + cols.map(function (c) { return "<th data-k='" + c[0] + "'" + (c[0] !== "nome" && c[0] !== "pos" ? " style='text-align:right'" : "") + (ordem.k === c[0] ? " aria-sort='" + (ordem.dir > 0 ? "ascending" : "descending") + "'" : "") + ">" + c[1] + "</th>"; }).join("") + "</tr></thead><tbody>";
      var n = 0;
      lista.forEach(function (m) {
        if (termo && m.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").indexOf(termo) < 0) return;
        n++;
        h += "<tr><td class='pos'>" + rankPop[m.nome] + "º</td><td><b>" + m.nome + "</b></td><td class='num'>" + num(m.pop, 0) + "</td><td class='num'>" + (m.pib != null ? num(m.pib / 1e6, 1) : "–") + "</td><td class='num'>" + (m.pc != null ? "R$ " + num(m.pc, 0) : "–") + "</td></tr>";
      });
      tab.innerHTML = h + "</tbody>";
      st.textContent = n + " de " + atual.lista.length + " municípios · " + NOME_UF[sel.value] + " · população " + atual.anoPop + ", PIB " + atual.anoPib + " · # = posição em habitantes no estado";
      Array.prototype.forEach.call(tab.querySelectorAll("th[data-k]"), function (th) {
        var k = th.dataset.k; if (k === "pos") k = "pop";
        th.onclick = function () { ordem = { k: k, dir: ordem.k === k ? -ordem.dir : (k === "nome" ? 1 : -1) }; desenhar(); };
      });
      avisarAltura();
    }
    function resumo() {
      var l = atual.lista, totPop = l.reduce(function (a, m) { return a + (m.pop || 0); }, 0), totPib = l.reduce(function (a, m) { return a + (m.pib || 0); }, 0);
      var comPc = l.filter(function (m) { return m.pc != null; }).sort(function (a, b) { return b.pc - a.pc; });
      var maior = l.slice().sort(function (a, b) { return b.pop - a.pop; })[0];
      res.innerHTML = "";
      res.appendChild(kpi({ nome: "Municípios", valor: num(l.length, 0), neutro: true }));
      res.appendChild(kpi({ nome: "Habitantes " + atual.anoPop, valor: compacto(totPop), neutro: true, sub: "Maior: " + maior.nome + " (" + compacto(maior.pop) + ")" }));
      if (comPc.length) res.appendChild(kpi({ nome: "Maior PIB per capita", valor: "R$ " + compacto(comPc[0].pc), neutro: true, sub: comPc[0].nome }));
      if (comPc.length) res.appendChild(kpi({ nome: "Menor PIB per capita", valor: "R$ " + compacto(comPc[comPc.length - 1].pc), neutro: true, sub: comPc[comPc.length - 1].nome }));
    }
    sel.addEventListener("change", function () {
      var uf = sel.value; if (!uf) return;
      st.textContent = "Carregando municípios de " + NOME_UF[uf] + " no IBGE…"; tab.innerHTML = ""; res.innerHTML = ""; busca.disabled = true;
      carregarMunicipios(uf).then(function (d) { if (sel.value !== uf) return; atual = d; busca.disabled = false; busca.value = ""; resumo(); desenhar(); })
        .catch(function () { st.textContent = "O IBGE não respondeu agora. Tente de novo em instantes."; });
    });
    busca.addEventListener("input", desenhar);
  }

  function fontes() {
    var f = [
      ["IBGE — Estimativas da População, Contas Regionais, IPCA/INPC/IPCA-15", "https://www.ibge.gov.br"],
      ["Banco Central — Selic (Copom) e séries SGS", "https://www.bcb.gov.br"],
      ["FGV IBRE — IGP-M", "https://portalibre.fgv.br"],
      ["B3 / Yahoo Finance — Ibovespa, ações, câmbio e commodities (mesmas cotações exibidas pela Investing.com)", "https://br.investing.com"],
      ["CEAGESP — Índice de Preços CEAGESP", "https://ceagesp.gov.br/indice-ceagesp/"],
      ["CEPEA/Esalq-USP — indicadores agropecuários", "https://www.cepea.org.br"],
      ["ANP — Levantamento semanal de preços de combustíveis e GLP", "https://www.gov.br/anp"],
      ["ANEEL — tarifas homologadas das distribuidoras", "https://dadosabertos.aneel.gov.br"]
    ];
    $("fontes").innerHTML = f.map(function (x) { return '<li><a href="' + x[1] + '" target="_blank" rel="noopener">' + x[0] + "</a></li>"; }).join("");
  }

  /* Camada ao vivo: dólar, euro e bitcoin direto da AwesomeAPI no navegador do visitante.
     Se a API não responder, ficam os valores do último fechamento (boletim.json). */
  function aoVivo() {
    if (!window.fetch) return;
    fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL").then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      [["dolar", "USDBRL", 4], ["euro", "EURBRL", 4], ["bitcoin", "BTCBRL", 0]].forEach(function (x) {
        var q = j[x[1]], card = document.querySelector('[data-ativo="' + x[0] + '"]'); if (!q || !card) return;
        var v = parseFloat(q.bid), pv = parseFloat(q.pctChange);
        card.querySelector(".kpi-valor").innerHTML = "<small>R$</small> " + num(v, x[2]);
        card.querySelector(".kpi-var").innerHTML = seta(pv) + pct(pv) + " hoje";
        var sub = card.querySelector(".kpi-sub"); if (sub) sub.textContent = "ao vivo · " + new Date(+q.timestamp * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      });
    }).catch(function () {});
  }

  /* Camada ao vivo: Selic e índices de preços direto do Banco Central (SGS) no navegador do visitante.
     O BCB não responde bem a servidores fora do Brasil, mas responde a quem acessa daqui. */
  function sgs(cod, diasAtras) {
    var f = function (x) { return ("0" + x.getDate()).slice(-2) + "/" + ("0" + (x.getMonth() + 1)).slice(-2) + "/" + x.getFullYear(); };
    var hoje = new Date(), ini = new Date(hoje.getTime() - diasAtras * 864e5);
    return fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs." + cod + "/dados?formato=json&dataInicial=" + f(ini) + "&dataFinal=" + f(hoje))
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { return j.map(function (x) { var p = x.data.split("/"); return { iso: p[2] + "-" + p[1] + "-" + p[0], v: parseFloat(x.valor) }; }); });
  }
  function acumula(vs) { return (vs.reduce(function (a, v) { return a * (1 + v / 100); }, 1) - 1) * 100; }
  function bcbAoVivo(d) {
    var hojeIso = new Date().toISOString().slice(0, 10);
    var series = { ipca: 433, ipca15: 7478, inpc: 188, igpm: 189 };
    var pedidos = Object.keys(series).map(function (k) { return sgs(series[k], 1200).then(function (s) { return [k, s]; }).catch(function () { return [k, null]; }); });
    pedidos.push(sgs(432, 900).then(function (s) { return ["selic", s]; }).catch(function () { return ["selic", null]; }));
    Promise.all(pedidos).then(function (res) {
      var mudou = false;
      res.forEach(function (r) {
        var k = r[0], s = r[1]; if (!s || !s.length) return;
        if (k === "selic") {
          s = s.filter(function (x) { return x.iso <= hojeIso; }); if (!s.length) return;
          var muds = [s[0]]; s.forEach(function (x) { if (x.v !== muds[muds.length - 1].v) muds.push(x); });
          var sel = d.juros.selic; sel.atual = s[s.length - 1].v;
          if (muds.length > 1) sel.anterior = muds[muds.length - 2].v;
          sel.hist = muds.map(function (x) { return [x.iso, x.v]; }).concat([[s[s.length - 1].iso, s[s.length - 1].v]]);
          mudou = true; return;
        }
        var it = (d.inflacao || []).find(function (i) { return i.id === k; }); if (!it) return;
        var hist = s.map(function (x, n) { var h = { ref: x.iso.slice(0, 7), mes: x.v }; if (n >= 11) h.acum12 = +acumula(s.slice(n - 11, n + 1).map(function (y) { return y.v; })).toFixed(2); return h; });
        var ult = hist[hist.length - 1], ano = ult.ref.slice(0, 4);
        if (it.ref && ult.ref < it.ref) return; // nunca volta para um mês mais antigo
        if (it.ref !== ult.ref) it.prox = null;
        it.ref = ult.ref; it.mes = ult.mes; it.acum12 = ult.acum12;
        it.acum_ano = +acumula(hist.filter(function (h) { return h.ref.slice(0, 4) === ano; }).map(function (h) { return h.mes; })).toFixed(2);
        it.hist = hist.slice(-24); mudou = true;
      });
      if (mudou) { $("kpis-juros").innerHTML = ""; try { juros(d); } catch (e) { console.error(e); } avisarAltura(); }
    });
  }

  /* Incorporação: informa a altura da página ao site que a exibe num iframe */
  function avisarAltura() {
    if (window.parent === window) return;
    var h = document.documentElement.scrollHeight;
    try { window.parent.postMessage({ boletimHasta: true, altura: h }, "*"); } catch (e) {}
  }

  function iniciar(d) {
    tip = $("tip");
    var at = new Date(d.atualizado_em);
    $("atualizado").innerHTML = "Atualizado em<br><b>" + at.toLocaleDateString("pt-BR") + " " + at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "</b>";
    if (window.Chart) { Chart.defaults.font.family = "Montserrat"; Chart.defaults.color = TXT2; }
    [mercado, juros, agro, energia, brasil].forEach(function (fn) { try { fn(d); } catch (e) { console.error(fn.name, e); } });
    fontes();
    try { municipios(); } catch (e) { console.error(e); }
    aoVivo();
    bcbAoVivo(d);
    if (window.parent !== window || /[?&]embed=1/.test(location.search)) document.documentElement.classList.add("embed");
    avisarAltura(); window.addEventListener("resize", avisarAltura); setInterval(avisarAltura, 1500);
  }

  /* ---------------- Cadastro (nome, telefone, e-mail) ---------------- */
  var CHAVE = "boletimHastaCadastro";
  function jaCadastrado() {
    try { if (localStorage.getItem(CHAVE)) return true; } catch (e) {}
    return document.cookie.split("; ").some(function (c) { return c.indexOf(CHAVE + "=") === 0; });
  }
  function lembrar() {
    var agora = new Date().toISOString();
    try { localStorage.setItem(CHAVE, agora); } catch (e) {}
    try { document.cookie = CHAVE + "=" + encodeURIComponent(agora) + "; max-age=" + (60 * 60 * 24 * 730) + "; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); } catch (e) {}
  }
  function mascaraTel(v) {
    v = v.replace(/\D/g, "").slice(0, 11);
    if (v.length > 10) return "(" + v.slice(0, 2) + ") " + v.slice(2, 7) + "-" + v.slice(7);
    if (v.length > 6) return "(" + v.slice(0, 2) + ") " + v.slice(2, 6) + "-" + v.slice(6);
    if (v.length > 2) return "(" + v.slice(0, 2) + ") " + v.slice(2);
    return v;
  }
  function cadastro() {
    var modal = $("cadastro"); if (!modal || jaCadastrado()) return;
    document.documentElement.classList.add("bloqueado"); modal.hidden = false;
    var f = $("cad-form"), erro = $("cad-erro"), btn = $("cad-btn");
    f.telefone.addEventListener("input", function () { f.telefone.value = mascaraTel(f.telefone.value); });
    setTimeout(function () { try { f.nome.focus(); } catch (e) {} }, 50);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nome = f.nome.value.trim(), tel = f.telefone.value.replace(/\D/g, ""), email = f.email.value.trim();
      if (nome.length < 2) { erro.textContent = "Informe seu nome."; f.nome.focus(); return; }
      if (tel.length < 10) { erro.textContent = "Informe um telefone com DDD."; f.telefone.focus(); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erro.textContent = "Informe um e-mail válido."; f.email.focus(); return; }
      if (!f.aceite.checked) { erro.textContent = "Marque a autorização para continuar."; return; }
      erro.textContent = ""; btn.disabled = true; btn.textContent = "Enviando…";
      var corpo = new URLSearchParams({ nome: nome, telefone: f.telefone.value, email: email, aceite: "sim", site: f.site.value,
        origem: (document.referrer || location.href).slice(0, 200), ua: navigator.userAgent.slice(0, 200) });
      var url = (window.BOLETIM_CONFIG || {}).cadastroUrl;
      var envio = url ? fetch(url, { method: "POST", mode: "no-cors", body: corpo }) : Promise.resolve();
      envio.then(liberar, function () {
        btn.disabled = false; btn.textContent = "Acessar o boletim";
        erro.textContent = "Não foi possível enviar agora. Verifique sua conexão e tente de novo.";
      });
      function liberar() { lembrar(); modal.hidden = true; document.documentElement.classList.remove("bloqueado"); avisarAltura(); }
    });
    // "Já me cadastrei": confere o e-mail na planilha e libera sem pedir os dados de novo
    var volta = $("cad-volta"), vErro = $("cad-volta-erro"), vBtn = $("cad-volta-btn");
    $("cad-ja").onclick = function () { f.hidden = true; volta.hidden = false; volta.email.value = f.email.value; setTimeout(function () { volta.email.focus(); }, 30); };
    $("cad-novo").onclick = function () { volta.hidden = true; f.hidden = false; };
    volta.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = volta.email.value.trim().toLowerCase(), url = (window.BOLETIM_CONFIG || {}).cadastroUrl;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { vErro.textContent = "Informe um e-mail válido."; return; }
      vErro.textContent = ""; vBtn.disabled = true; vBtn.textContent = "Verificando…";
      fetch(url + "?acao=verificar&email=" + encodeURIComponent(email)).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.cadastrado) { lembrar(); modal.hidden = true; document.documentElement.classList.remove("bloqueado"); avisarAltura(); }
        else { vErro.textContent = "Não encontramos esse e-mail. Faça o cadastro rapidinho."; vBtn.disabled = false; vBtn.textContent = "Entrar"; }
      }).catch(function () { vErro.textContent = "Não foi possível verificar agora. Tente de novo."; vBtn.disabled = false; vBtn.textContent = "Entrar"; });
    });
  }

  cadastro();
  if (window.BOLETIM_DATA) iniciar(window.BOLETIM_DATA);
  else fetch("data/boletim.json?v=" + Date.now()).then(function (r) { return r.json(); }).then(iniciar).catch(function (e) { $("atualizado").textContent = "Não foi possível carregar os dados."; console.error(e); });
})();
