#!/usr/bin/env python3
"""
Atualiza data/boletim.json para o Boletim Hasta.

Cada bloco (mercado, juros, inflação, CEAGESP, CEPEA, combustíveis, energia, IBGE)
roda isolado: se uma fonte falhar, o bloco mantém o último dado válido e o erro
fica registrado em data/status.json. Nada é apagado por falha de fonte.

Uso:  python scripts/atualizar.py            (atualiza tudo)
      python scripts/atualizar.py mercado    (só os blocos indicados)
"""
import base64, datetime as dt, io, json, re, sys, traceback, unicodedata
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parents[1]
ARQ = RAIZ / "data" / "boletim.json"
STATUS = RAIZ / "data" / "status.json"
TZ = dt.timezone(dt.timedelta(hours=-3))
UA = {"User-Agent": "Mozilla/5.0 (BoletimHasta; +https://boletim.hastamarketing.com)", "Accept-Language": "pt-BR,pt;q=0.9"}
S = requests.Session(); S.headers.update(UA)

UF = {"AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
      "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
      "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
      "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins"}
IBGE_COD = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN",
            "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC",
            "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn").upper().strip()


def nome_para_uf(nome):
    alvo = sem_acento(nome)
    for uf, n in UF.items():
        if sem_acento(n) == alvo or alvo == uf:
            return uf
    return None


def get_json(url, tentativas=3, **kw):
    ultimo = None
    for t in range(tentativas):
        try:
            r = S.get(url, timeout=(20, 90), **kw)
            if r.status_code >= 500:
                raise ConnectionError(f"{r.status_code} em {url}")
            r.raise_for_status(); return r.json()
        except requests.HTTPError:
            raise
        except Exception as e:  # timeout / conexão: tenta de novo
            ultimo = e
            import time; time.sleep(5 * (t + 1))
    raise ultimo


def br_num(s):
    s = str(s).strip().replace("%", "").replace("R$", "").replace("\xa0", "").replace(" ", "")
    s = s.replace("+", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    return float(s)


# ------------------------------------------------------------------ mercado
YAHOO = {"ibovespa": ("^BVSP", "Ibovespa", "pts"), "dolar": ("BRL=X", "Dólar comercial", "R$"), "euro": ("EURBRL=X", "Euro comercial", "R$"),
         "bitcoin": ("BTC-BRL", "Bitcoin", "R$"), "brent": ("BZ=F", "Petróleo Brent", "US$"), "wti": ("CL=F", "Petróleo WTI", "US$")}


def yahoo(sym, rng="1y", interval="1d"):
    j = get_json(f"https://query1.finance.yahoo.com/v8/finance/chart/{requests.utils.quote(sym)}", params={"range": rng, "interval": interval})
    res = j["chart"]["result"][0]
    ts, cl = res["timestamp"], res["indicators"]["quote"][0]["close"]
    pts = [(dt.datetime.fromtimestamp(t, TZ).date().isoformat(), c) for t, c in zip(ts, cl) if c is not None]
    return pts


def r2(v):
    return round(v, 2) if v is not None else None


def variacao(pts, dias=None, desde=None):
    if len(pts) < 2:
        return None
    ult = pts[-1][1]
    if desde:
        base = [p for p in pts if p[0] < desde]
        return (ult / base[-1][1] - 1) * 100 if base else None
    return (ult / pts[-1 - dias][1] - 1) * 100 if len(pts) > dias else None


def ibov_composicao():
    payload = base64.b64encode(json.dumps({"language": "pt-br", "pageNumber": 1, "pageSize": 120, "index": "IBOV", "segment": "1"}).encode()).decode()
    j = get_json(f"https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/{payload}")
    return [(r["cod"].strip(), r.get("asset", "").strip().title()) for r in j["results"]]


def awesome_hist(par, dias=365):
    j = get_json(f"https://economia.awesomeapi.com.br/json/daily/{par}/{dias}")
    pts = sorted((dt.datetime.fromtimestamp(int(x["timestamp"]), TZ).date().isoformat(), float(x["bid"])) for x in j)
    out = {}
    for dia, v in pts:  # um valor por dia (o último)
        out[dia] = v
    return sorted(out.items())


def bloco_mercado(d):
    ativos, data_ref, falhas = [], None, []
    anteriores = {a["id"]: a for a in d.get("mercado", {}).get("ativos", [])}
    for aid, (sym, nome, un) in YAHOO.items():
        pts = None
        for fonte in (lambda: yahoo(sym), lambda: awesome_hist({"bitcoin": "BTC-BRL", "dolar": "USD-BRL", "euro": "EUR-BRL"}[aid])):
            try:
                pts = fonte()
                if len(pts) >= 2:
                    break
            except Exception as e:
                falhas.append(f"{aid}: {e}")
                pts = None
        if not pts:
            if aid in anteriores:
                ativos.append(anteriores[aid])
            continue
        hoje = pts[-1][0]; data_ref = max(data_ref or hoje, hoje)
        ano = hoje[:4]; mes = hoje[:7]
        ativos.append({"id": aid, "nome": nome, "unidade": un, "valor": round(pts[-1][1], 4), "var_dia": r2(variacao(pts, 1)),
                       "var_mes": r2(variacao(pts, desde=mes + "-01")), "var_ano": r2(variacao(pts, desde=ano + "-01-01")),
                       "var_12m": round((pts[-1][1] / pts[0][1] - 1) * 100, 2),
                       "data": hoje, "hist": [[p[0], round(p[1], 4)] for p in pts[-260:]]})
    novos = len(ativos) - sum(1 for a in ativos if a is anteriores.get(a["id"]))
    if novos == 0:
        raise RuntimeError("nenhuma cotação obtida: " + "; ".join(falhas[:3]))
    for a in ativos:
        a.setdefault("data", a["hist"][-1][0] if a.get("hist") else None)
    m = d.setdefault("mercado", {})
    m["ativos"], m["data"] = ativos, data_ref
    # maiores altas / quedas entre as ações do Ibovespa
    try:
        movs = []
        for cod, nome in ibov_composicao():
            try:
                p = yahoo(cod + ".SA", rng="5d")
                if len(p) >= 2 and p[-1][0] == data_ref:
                    movs.append({"ticker": cod, "nome": nome, "var": round((p[-1][1] / p[-2][1] - 1) * 100, 2)})
            except Exception:
                continue
        if len(movs) >= 20:
            movs.sort(key=lambda x: x["var"])
            m["maiores_altas"] = list(reversed(movs[-5:]))
            m["maiores_baixas"] = movs[:5]
    except Exception as e:
        print("  altas/quedas: mantendo anteriores →", e)


# ------------------------------------------------------------------ BCB (Selic e inflação)
def sgs(cod, n=30, diaria=False):
    # a API do BCB limita "ultimos/N" a 20 registros; por isso pedimos um intervalo de datas
    hoje = dt.date.today()
    ini = hoje - dt.timedelta(days=(n * 2 + 10) if diaria else (n * 31 + 40))
    j = get_json(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados",
                 params={"formato": "json", "dataInicial": ini.strftime("%d/%m/%Y"), "dataFinal": hoje.strftime("%d/%m/%Y")})
    return [(dt.datetime.strptime(x["data"], "%d/%m/%Y").date(), float(x["valor"])) for x in j]


def acumula(vals):
    a = 1.0
    for v in vals:
        a *= 1 + v / 100
    return (a - 1) * 100


def bloco_juros(d):
    serie = [x for x in sgs(432, 800, diaria=True) if x[0] <= dt.date.today()]  # meta Selic (a série traz datas futuras até o próximo Copom)
    mudancas = [serie[0]]
    for dia, v in serie[1:]:
        if v != mudancas[-1][1]:
            mudancas.append((dia, v))
    sel = d.setdefault("juros", {}).setdefault("selic", {})
    sel["atual"] = serie[-1][1]
    sel["anterior"] = mudancas[-2][1] if len(mudancas) > 1 else None
    sel["hist"] = [[x[0].isoformat(), x[1]] for x in mudancas] + [[serie[-1][0].isoformat(), serie[-1][1]]]


INFL = [("ipca", "IPCA", "IBGE", 433), ("ipca15", "IPCA-15", "IBGE", 7478), ("inpc", "INPC", "IBGE", 188), ("igpm", "IGP-M", "FGV", 189)]


def bloco_inflacao(d):
    antigos = {i["id"]: i for i in d.get("inflacao", [])}
    novos = []
    for iid, nome, fonte, cod in INFL:
        s = sgs(cod, 40)
        hist = []
        for k in range(len(s)):
            item = {"ref": s[k][0].strftime("%Y-%m"), "mes": s[k][1]}
            if k >= 11:
                item["acum12"] = round(acumula([x[1] for x in s[k - 11:k + 1]]), 2)
            hist.append(item)
        ult = s[-1][0]
        ano = [x[1] for x in s if x[0].year == ult.year]
        novos.append({"id": iid, "nome": nome, "fonte": fonte, "ref": ult.strftime("%Y-%m"), "mes": s[-1][1],
                      "acum_ano": round(acumula(ano), 2), "acum12": hist[-1].get("acum12"),
                      "prox": antigos.get(iid, {}).get("prox"), "hist": hist[-24:]})
    d["inflacao"] = novos


# ------------------------------------------------------------------ CEAGESP
SET_CEA = ["frutas", "legumes", "verduras", "diversos", "pescados"]


def ceagesp_mes(ano, m):
    from bs4 import BeautifulSoup
    url = f"https://ceagesp.gov.br/entrepostos/servicos/indice-ceagesp/indice-ceagesp-{MESES[m - 1]}-{ano}/"
    r = S.get(url, timeout=40)
    if r.status_code != 200:
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    txt = soup.get_text(" ", strip=True)
    reg = {"ref": f"{ano}-{m:02d}"}
    mg = re.search(r"Ceagesp\s+(?:sub\w+|ca\w+|vari\w+)\s+([+\-−]?\s?\d+,\d+)%", txt, re.I)
    if mg:
        reg["geral"] = br_num(mg.group(1).replace("−", "-"))
    for tr in soup.select("table tr"):
        tds = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if len(tds) >= 2:
            k = sem_acento(tds[0]).lower()
            if k in SET_CEA or k == "geral":
                try:
                    reg[k] = br_num(tds[1])
                except ValueError:
                    pass
    for k in SET_CEA:  # fallback pelo texto "O setor de FRUTAS caiu -0,35%"
        if k not in reg:
            mm = re.search(r"setor de\s+" + k + r"\s+\w+\s+([+\-]?\d+,\d+)%", sem_acento(txt).lower())
            if mm:
                reg[k] = br_num(mm.group(1))
    # destaques: em cada "O setor de X ..." → "principais altas ocorreram nos preços de A (+n%), B (+n%)..."
    dest = {}
    for trecho in re.split(r"O setor de\s+", txt)[1:]:
        k = sem_acento(trecho.split()[0]).lower()
        if k not in SET_CEA:
            continue
        def itens(tipo):
            mm = re.search(r"principais " + tipo + r" ocorreram nos pre\w+ d[eo]s?\s+(.*?)\.\s", trecho, re.I | re.S)
            if not mm:
                return []
            return [[n.strip(" e").strip().title(), br_num(v)] for n, v in re.findall(r"([^,()]+?)\s*\(([+\-−]?\d+,\d+)%\)", mm.group(1).replace("−", "-"))][:5]
        altas, quedas = itens("altas"), itens("quedas")
        if altas or quedas:
            dest[k] = {"altas": altas, "quedas": quedas}
    return reg if len(reg) >= 4 else None, dest


def bloco_ceagesp(d):
    c = d.setdefault("ceagesp", {"meses": []})
    meses = {x["ref"]: x for x in c.get("meses", [])}
    hoje = dt.date.today()
    y, m = hoje.year, hoje.month
    novos_dest = None
    for _ in range(14):  # varre os últimos 14 meses
        res = ceagesp_mes(y, m)
        if res and res[0]:
            reg, dest = res
            meses[reg["ref"]] = {**meses.get(reg["ref"], {}), **reg}
            if novos_dest is None and dest:
                novos_dest = {"ref": reg["ref"], "setores": dest}
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    lista = sorted(meses.values(), key=lambda x: x["ref"])[-24:]
    c["meses"] = lista
    if novos_dest and len(novos_dest["setores"]) >= 3:
        c["destaques"] = novos_dest
    # acumulados no ano e 12 meses calculados a partir dos meses
    ult = lista[-1]
    acum = {"ref": ult["ref"]}
    for k in ["geral"] + SET_CEA:
        ano = [x[k] for x in lista if x["ref"][:4] == ult["ref"][:4] and k in x]
        m12 = [x[k] for x in lista[-12:] if k in x]
        acum[k] = {"ano": round(acumula(ano), 2), "m12": round(acumula(m12), 2) if len(m12) == 12 else c.get("acumulado", {}).get(k, {}).get("m12")}
    c["acumulado"] = acum


# ------------------------------------------------------------------ CEPEA
CEPEA = [("Boi gordo", "boi-gordo", "Indicador CEPEA/B3 – SP", "R$/@"), ("Soja", "soja", "Indicador Cepea/Esalq – Paranaguá", "R$/sc 60 kg"),
         ("Milho", "milho", "Indicador Esalq/B3 – Campinas", "R$/sc 60 kg"), ("Café arábica", "cafe", "Indicador Cepea/Esalq", "R$/sc 60 kg"),
         ("Açúcar cristal", "acucar", "Indicador Cepea/Esalq – SP", "R$/sc 50 kg"), ("Etanol hidratado", "etanol", "Indicador semanal – SP", "R$/litro"),
         ("Trigo", "trigo", "Indicador Cepea/Esalq – PR", "R$/t"), ("Algodão", "algodao", "Indicador Cepea/Esalq", "c.R$/lp"),
         ("Frango congelado", "frango", "Atacado – SP", "R$/kg"), ("Suíno vivo", "suino", "Indicador Cepea/Esalq", "R$/kg"),
         ("Arroz em casca", "arroz", "Indicador Esalq/Senar-RS", "R$/sc 50 kg"), ("Ovos", "ovos", "Atacado – Bastos (SP)", "R$/cx 30 dz")]


def bloco_cepea(d):
    from bs4 import BeautifulSoup
    antigos = {(x["produto"]): x for x in d.get("cepea", [])}
    saida = []
    for prod, slug, praca, un in CEPEA:
        try:
            r = S.get(f"https://www.cepea.org.br/br/indicador/{slug}.aspx", timeout=40)
            r.raise_for_status()
            tab = BeautifulSoup(r.text, "html.parser").select_one("table")
            linhas = [[c.get_text(strip=True) for c in tr.find_all("td")] for tr in tab.select("tbody tr")]
            linhas = [l for l in linhas if len(l) >= 3]
            data_s, valor, vdia = linhas[0][0], br_num(linhas[0][1]), linhas[0][2]
            data_iso = dt.datetime.strptime(data_s, "%d/%m/%Y").date().isoformat()
            ant = {"valor": br_num(linhas[-1][1]), "data": dt.datetime.strptime(linhas[-1][0], "%d/%m/%Y").date().isoformat()} if len(linhas) > 1 else None
            saida.append({"produto": prod, "praca": praca, "valor": valor, "unidade": un, "data": data_iso,
                          "var": br_num(vdia) if re.search(r"\d", vdia) else None, "periodo": "dia", "ant": ant})
        except Exception as e:
            print(f"  CEPEA {prod}: mantendo anterior →", e)
            if prod in antigos:
                saida.append(antigos[prod])
    for k, v in antigos.items():  # preserva itens da base que não estão na lista de raspagem
        if k not in {s["produto"] for s in saida}:
            saida.append(v)
    novos = sum(1 for s in saida if s.get("periodo") == "dia")
    if novos == 0:
        raise RuntimeError("nenhum indicador CEPEA lido")
    d["cepea"] = saida


# ------------------------------------------------------------------ ANP (combustíveis e GLP)
ANP_PAG = "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas"
PROD = {"GASOLINA COMUM": "gasolina", "ETANOL HIDRATADO": "etanol", "OLEO DIESEL S10": "diesel_s10", "GLP": "glp"}


def anp_aba(raw, chave):
    """Lê a aba cujo nome contém `chave` (ESTADO/BRASIL) e acha a linha de cabeçalho."""
    import pandas as pd
    xls = pd.ExcelFile(io.BytesIO(raw))
    abas = [a for a in xls.sheet_names if chave in sem_acento(a)] or xls.sheet_names
    for aba in abas:
        bruto = pd.read_excel(xls, sheet_name=aba, header=None)
        for i in range(min(30, len(bruto))):
            linha = [sem_acento(x) for x in bruto.iloc[i].tolist()]
            if any("PRODUTO" in c for c in linha) and any("PRECO MEDIO" in c for c in linha):
                df = bruto.iloc[i + 1:].copy()
                df.columns = linha
                return df
    raise RuntimeError(f"aba {chave} não reconhecida na planilha da ANP")


def anp_col(df, *partes):
    return next(c for c in df.columns if all(p in c for p in partes))


def bloco_combustiveis(d):
    import pandas as pd
    html = S.get(ANP_PAG, timeout=60).text
    links = re.findall(r'href="([^"]*resumo_semanal[^"]*\.xlsx)"', html, re.I)
    if not links:
        raise RuntimeError("planilha 'resumo_semanal' não encontrada na página da ANP")
    abs_ = lambda u: u if u.startswith("http") else "https://www.gov.br" + u
    raw = S.get(abs_(links[0]), timeout=120).content

    df = anp_aba(raw, "ESTADO")
    c_est, c_prod = anp_col(df, "ESTADO"), anp_col(df, "PRODUTO")
    c_preco = anp_col(df, "PRECO MEDIO", "REVENDA")
    c_ini, c_fim = anp_col(df, "DATA INICIAL"), anp_col(df, "DATA FINAL")
    estados = {}
    for _, r in df.iterrows():
        uf = nome_para_uf(r[c_est]); p = PROD.get(sem_acento(r[c_prod]))
        if uf and p and pd.notna(r[c_preco]):
            estados.setdefault(uf, {"uf": uf, "nome": UF[uf]})[p] = round(float(r[c_preco]), 2)
    if len(estados) < 20:
        raise RuntimeError(f"apenas {len(estados)} estados lidos")
    fmt = lambda x: pd.to_datetime(x).strftime("%d/%m/%Y")
    semana = f"{fmt(df[c_ini].dropna().iloc[0])} a {fmt(df[c_fim].dropna().iloc[0])}"
    c = d.setdefault("combustiveis", {})
    c["semana"] = c["semana_glp_estados"] = semana
    c["estados"] = sorted(estados.values(), key=lambda x: x["uf"])

    # média Brasil das últimas semanas (aba BRASIL de cada planilha)
    hist = {h["semana"]: h for h in c.get("hist_brasil", [])}
    br_atual = None
    for k, link in enumerate(links[:8]):
        try:
            rb = raw if k == 0 else S.get(abs_(link), timeout=120).content
            b = anp_aba(rb, "BRASIL")
            cp, cpr, cf = anp_col(b, "PRODUTO"), anp_col(b, "PRECO MEDIO", "REVENDA"), anp_col(b, "DATA FINAL")
            reg = {}
            for _, r in b.iterrows():
                p = PROD.get(sem_acento(r[cp]))
                if p and pd.notna(r[cpr]):
                    reg[p] = round(float(r[cpr]), 2)
            fim_iso = pd.to_datetime(b[cf].dropna().iloc[0]).date().isoformat()
            hist[fim_iso] = {"semana": fim_iso, **reg}
            if k == 0:
                br_atual = reg
        except Exception as e:
            print("  ANP histórico:", link, e)
    if not br_atual:
        br_atual = {p: round(sum(e[p] for e in estados.values() if p in e) / max(1, sum(1 for e in estados.values() if p in e)), 2) for p in PROD.values()}
    c["brasil"] = {"semana": semana, **br_atual, "glp_semana": semana}
    c["hist_brasil"] = sorted(hist.values(), key=lambda h: h["semana"])[-52:]


# ------------------------------------------------------------------ ANEEL
DIST_UF = {"ENERGISA AC": "AC", "EQUATORIAL AL": "AL", "CEA": "AP", "AMAZONAS": "AM", "COELBA": "BA", "ENEL CE": "CE", "NEOENERGIA BRASILIA": "DF",
           "CEB": "DF", "EDP ES": "ES", "EQUATORIAL GO": "GO", "EQUATORIAL MA": "MA", "EMT": "MT", "ENERGISA MT": "MT", "EMS": "MS", "ENERGISA MS": "MS",
           "CEMIG": "MG", "EQUATORIAL PA": "PA", "EPB": "PB", "ENERGISA PB": "PB", "COPEL": "PR", "NEOENERGIA PE": "PE", "CELPE": "PE",
           "EQUATORIAL PI": "PI", "ENEL RJ": "RJ", "LIGHT": "RJ", "COSERN": "RN", "RGE": "RS", "CEEE": "RS", "ENERGISA RO": "RO", "RORAIMA": "RR",
           "CELESC": "SC", "CPFL PAULISTA": "SP", "CPFL PIRATININGA": "SP", "ENEL SP": "SP", "ELETROPAULO": "SP", "EDP SP": "SP", "ESE": "SE",
           "ENERGISA SE": "SE", "ETO": "TO", "ENERGISA TO": "TO"}


def bloco_energia(d):
    base = "https://dadosabertos.aneel.gov.br/api/3/action/"
    pkg = get_json(base + "package_show", params={"id": "tarifas-distribuidoras-energia-eletrica"})["result"]
    res = next(r for r in pkg["resources"] if r.get("datastore_active"))
    filtros = {"DscSubGrupo": "B1", "DscModalidadeTarifaria": "Convencional", "DscBaseTarifaria": "Tarifa de Aplicação", "DscDetalhe": "Não se aplica"}
    regs, off = [], 0
    while True:
        j = get_json(base + "datastore_search", params={"resource_id": res["id"], "filters": json.dumps(filtros), "limit": 5000, "offset": off,
                                                         "sort": "DatInicioVigencia desc"})["result"]
        regs += j["records"]; off += 5000
        if off >= j.get("total", 0) or off > 30000:
            break
    hoje = dt.date.today().isoformat()
    atual = {}
    for r in regs:
        ini, fim = str(r.get("DatInicioVigencia", ""))[:10], str(r.get("DatFimVigencia", ""))[:10]
        if ini > hoje or (fim and fim < hoje):
            continue
        sig = r["SigAgente"]
        if sig not in atual or ini > atual[sig]["ini"]:
            tusd = float(str(r["VlrTUSD"]).replace(",", ".")); te = float(str(r["VlrTE"]).replace(",", "."))
            atual[sig] = {"ini": ini, "tarifa": round((tusd + te) / 1000, 4)}
    dist = []
    for sig, v in atual.items():
        uf = next((u for k, u in DIST_UF.items() if k in sem_acento(sig)), None)
        if uf:
            dist.append({"uf": uf, "distribuidora": sig, "tarifa": v["tarifa"]})
    if len(dist) < 20:
        raise RuntimeError(f"apenas {len(dist)} distribuidoras mapeadas")
    e = d.setdefault("energia", {})
    e["distribuidoras"] = sorted(dist, key=lambda x: -x["tarifa"])
    e["ref"] = "Tarifas ANEEL vigentes em " + dt.date.today().strftime("%d/%m/%Y")


# ------------------------------------------------------------------ IBGE
def sidra_uf(agregado, variavel, periodo="-1"):
    j = get_json(f"https://servicodados.ibge.gov.br/api/v3/agregados/{agregado}/periodos/{periodo}/variaveis/{variavel}", params={"localidades": "N3[all]|N1[all]"})
    out, ano = {}, None
    for s in j[0]["resultados"][0]["series"]:
        loc = s["localidade"]["id"]; ano, val = list(s["serie"].items())[-1]
        out["BR" if loc == "1" else IBGE_COD.get(loc)] = float(val)
    return out, int(ano)


def bloco_ibge(d):
    g = d.setdefault("ibge", {})
    pop, ano = sidra_uf(6579, 9324)
    pop_ant, _ = sidra_uf(6579, 9324, str(ano - 1))
    g["populacao"] = {"ano": ano, "brasil": int(pop["BR"]), "brasil_ant": int(pop_ant["BR"]),
                      "estados": [{"uf": u, "nome": UF[u], "pop": int(v)} for u, v in pop.items() if u in UF]}
    # PIB per capita: procura a variável "per capita" nos metadados da tabela 5938
    meta = get_json("https://servicodados.ibge.gov.br/api/v3/agregados/5938/metadados")
    var_pc = next((v["id"] for v in meta["variaveis"] if "per capita" in v["nome"].lower()), None)
    if var_pc:
        pc, ano_pc = sidra_uf(5938, var_pc)
        g["pib_pc"] = {"ano": ano_pc, "brasil": pc["BR"], "estados": [{"uf": u, "nome": UF[u], "valor": v, "aprox": False} for u, v in pc.items() if u in UF]}
    else:  # PIB (mil R$) ÷ população do mesmo ano
        pib, ano_pc = sidra_uf(5938, 37)
        popa, _ = sidra_uf(6579, 9324, str(ano_pc))
        g["pib_pc"] = {"ano": ano_pc, "brasil": round(pib["BR"] * 1000 / popa["BR"], 2),
                       "estados": [{"uf": u, "nome": UF[u], "valor": round(pib[u] * 1000 / popa[u], 2), "aprox": False} for u in UF if u in pib and u in popa]}


BLOCOS = {"mercado": bloco_mercado, "juros": bloco_juros, "inflacao": bloco_inflacao, "ceagesp": bloco_ceagesp, "cepea": bloco_cepea,
          "combustiveis": bloco_combustiveis, "energia": bloco_energia, "ibge": bloco_ibge}


def main(sel):
    d = json.loads(ARQ.read_text(encoding="utf-8"))
    status = json.loads(STATUS.read_text(encoding="utf-8")) if STATUS.exists() else {}
    agora = dt.datetime.now(TZ).isoformat(timespec="seconds")
    algum_ok = False
    for nome, fn in BLOCOS.items():
        if sel and nome not in sel:
            continue
        print(f"→ {nome}")
        copia = json.loads(json.dumps(d))
        try:
            fn(d)
            status[nome] = {"ok": True, "em": agora}
            algum_ok = True
            print("  ok")
        except Exception as e:
            d = copia  # descarta alterações parciais do bloco
            status[nome] = {"ok": False, "em": agora, "erro": f"{type(e).__name__}: {e}", "ultimo_ok": status.get(nome, {}).get("em")}
            print("  FALHOU (mantido o último dado):", e)
            traceback.print_exc(limit=1)
    if algum_ok:
        d["atualizado_em"] = agora
        d["modo"] = "automatico"
    ARQ.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
