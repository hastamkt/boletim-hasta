/**
 * Boletim Hasta — recebe os cadastros do boletim e grava na planilha
 * "Cadastros – Boletim Hasta" (Google Drive do Túlio).
 * Instalação: planilha → Extensões → Apps Script → cole este código →
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
    var aba = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    aba.appendRow([new Date(), nome, "'" + tel, email, p.aceite === "sim" ? "sim" : "não", limpa(p.origem, 200), limpa(p.ua, 200)]);
  } finally { lock.releaseLock(); }
  return resposta({ ok: true });
}
function doGet() { return resposta({ ok: true, servico: "cadastro boletim hasta" }); }
function limpa(v, max) { v = String(v || "").trim().replace(/^[=+\-@]/, "'$&"); return v.slice(0, max); }
function resposta(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
