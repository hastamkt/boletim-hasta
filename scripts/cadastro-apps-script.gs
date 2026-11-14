/**
 * Boletim Hasta — recebe os cadastros do boletim e grava na planilha
 * "Cadastros – Boletim Hasta" (Google Drive do Túlio).
 * Instalação: script.new → cole este código →
 * Implantar → Nova implantação → App da Web → Executar como: Eu → Acesso: Qualquer pessoa.
 */
function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.site) return resposta({ ok: true });            // armadilha anti-robô (campo oculto preenchido)
  var nome = limpa(p.nome, 120), tel = limpa(p.telefone, 30), email = limpa(p.email, 160).toLowerCase();
  if (nome.length < 2 || tel.replace(/\D/g, "").length < 10 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return resposta({ ok: false, erro: "dados inválidos" });
  }
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var aba = planilha();
    if (existe(aba, email)) return resposta({ ok: true, repetido: true });   // não duplica quem já se cadastrou
    aba.appendRow([new Date(), nome, "'" + tel, email, p.aceite === "sim" ? "sim" : "não", limpa(p.origem, 200), limpa(p.ua, 200)]);
  } finally { lock.releaseLock(); }
  return resposta({ ok: true });
}
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.acao === "verificar") {
    var email = limpa(p.email, 160).toLowerCase();
    return resposta({ cadastrado: !!email && existe(planilha(), email) });   // responde só sim/não
  }
  return resposta({ ok: true, servico: "cadastro boletim hasta" });
}
function planilha() { return SpreadsheetApp.openById("1koTX6iR6B6m7seGNlBPS6iYSQa1PzeVSc5Gn1BZg4V0").getSheets()[0]; }
function existe(aba, email) {
  var n = aba.getLastRow(); if (n < 2) return false;
  return aba.getRange(2, 4, n - 1, 1).getValues().some(function (r) { return String(r[0]).trim().toLowerCase() === email; });
}
function limpa(v, max) { v = String(v || "").trim().replace(/^[=+\-@]/, "'$&"); return v.slice(0, max); }
function resposta(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
