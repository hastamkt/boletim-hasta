# Boletim Econômico Hasta — hastamarketing.com/boletim

Dashboard estático (HTML + CSS + JS) na identidade visual da Hasta, alimentado por `data/boletim.json`.
Um robô no GitHub Actions atualiza esse arquivo várias vezes por dia, direto das fontes oficiais, e publica no site.

```
index.html               página
assets/style.css         identidade visual (cores, fontes, layout)
assets/app.js            gráficos e tabelas (Chart.js)
data/boletim.json        dados exibidos (gerado pelo robô)
data/status.json         saúde de cada fonte na última execução
scripts/atualizar.py     coleta dos dados
.github/workflows/       agenda do robô + envio por FTP para o site
incorporar.html          código para colar no site (Caminho B)
CNAME                    domínio para o GitHub Pages (Caminho B)
```

## Colocar dentro do hastamarketing.com

O robô roda no GitHub Actions (gratuito) e atualiza os dados 3× por dia útil. Escolha o caminho conforme a plataforma do site:

### Caminho A — hospedagem com FTP (Hostinger, cPanel, Locaweb, HostGator, KingHost…) → `hastamarketing.com/boletim`
1. Crie um repositório **privado** no GitHub (ex.: `boletim-hasta`) e envie todos os arquivos desta pasta, incluindo `.github`.
2. *Settings → Actions → General → Workflow permissions → Read and write permissions*.
3. *Settings → Secrets and variables → Actions → New repository secret* e cadastre:
   - `FTP_SERVER` — ex.: `ftp.hastamarketing.com` (aparece no painel da hospedagem)
   - `FTP_USERNAME` e `FTP_PASSWORD` — usuário de FTP (crie um só para isso, se preferir)
   - opcionais: `FTP_DIR` (padrão `public_html/boletim/`) e `FTP_PROTOCOL` (padrão `ftps`; use `ftp` se a hospedagem não aceitar FTPS)
4. *Actions → Atualizar dados do boletim → Run workflow*. Em ~3 minutos o boletim está em **hastamarketing.com/boletim** e passa a se atualizar sozinho.
5. Coloque um link “Boletim” no menu do site apontando para `/boletim`.

### GoDaddy
- **Hospedagem na Web (cPanel):** Caminho A. `FTP_SERVER` = `ftp.hastamarketing.com` (ou o IP do painel), usuário/senha de FTP do cPanel, `FTP_DIR` = `public_html/boletim/`. Se o FTPS falhar, cadastre `FTP_PROTOCOL` = `ftp`.
- **WordPress Gerenciado:** só aceita SFTP. Cadastre `SFTP_SERVER`, `SFTP_USERNAME`, `SFTP_PASSWORD` (painel do WordPress Gerenciado → Configurações → SFTP/SSH) e `SFTP_DIR` = `html/boletim`.
- **Construtor de Sites (Sites + Marketing):** não tem FTP → Caminho B; o CNAME `boletim` é criado em *Meus Produtos → Domínios → DNS*, e o código de `incorporar.html` vai numa seção **HTML** da página.

### Caminho B — construtor de sites (WordPress.com, Wix, Elementor, Hostinger Website Builder, Webflow…)
1. Publique o boletim pelo GitHub Pages: no repositório, *Settings → Pages → Deploy from a branch → main / (root)*; em *Custom domain* use `boletim.hastamarketing.com` e, no DNS do domínio, crie um `CNAME` com nome `boletim` apontando para `SEU-USUARIO.github.io`. (Repositório público, ou plano pago do GitHub para Pages em repositório privado.)
2. Faça os passos 2 e 4 do Caminho A (sem os segredos de FTP).
3. Crie a página **Boletim** no site e cole o código de `incorporar.html` num bloco de HTML/“Incorporar código”. A altura se ajusta sozinha.

### Atualização automática — o que acontece
- **18h40 (dias úteis):** fechamento da bolsa, câmbio, petróleo, maiores altas e quedas.
- **12h07 (dias úteis):** atualização no meio do pregão.
- **08h17 (todo dia):** Selic, IPCA/INPC/IGP-M, CEAGESP, CEPEA, ANP, ANEEL e IBGE (cada um muda quando o órgão divulga).
- **Ao vivo no navegador:** dólar, euro e bitcoin são atualizados a cada visita, direto da AwesomeAPI.

## Fontes por bloco

| Bloco | Fonte usada pelo robô |
|---|---|
| Ibovespa, dólar, euro, bitcoin, Brent, WTI | Yahoo Finance (mesmas cotações de mercado exibidas pela Investing.com) |
| Maiores altas e quedas | Carteira do dia do IBOV (B3) + fechamento de cada ação |
| Selic, IPCA, IPCA-15, INPC, IGP-M | Banco Central — SGS (séries 432, 433, 7478, 188, 189) |
| Índice CEAGESP por segmento | Páginas mensais do Índice CEAGESP |
| Indicadores CEPEA | Páginas de indicadores Cepea/Esalq |
| Gasolina, etanol, diesel, GLP por estado | Planilha semanal por estado da ANP |
| Tarifa de energia por distribuidora | Dados abertos ANEEL (tarifas homologadas, B1 convencional) |
| População e PIB per capita | API de agregados do IBGE (tabelas 6579 e 5938) |

**Por que não a Investing.com direto?** O site não tem API pública e bloqueia coleta automatizada nos termos de uso;
os valores são os mesmos de mercado, então o robô usa fontes abertas e o boletim cita a Investing como referência.

## Se uma fonte falhar

Cada bloco roda isolado. Se um site mudar ou sair do ar, aquele bloco **mantém o último dado válido** e o erro
fica em `data/status.json` (campo `erro`). Os outros blocos seguem atualizando normalmente.
Os coletores de CEAGESP, CEPEA e ANP leem páginas/planilhas; se o layout delas mudar, ajuste a função
correspondente em `scripts/atualizar.py`.

## Personalizar

- **Fonte Intro Rust:** é comercial; coloque o arquivo licenciado em `assets/fonts/IntroRust.woff2` e ela passa a valer nos títulos (sem ele, usa League Spartan).
- **Cores:** variáveis no topo de `assets/style.css`. As cores de séries dos gráficos (`--serie-1` roxo, `--serie-2` ouro) foram ajustadas a partir da paleta da marca para ter contraste e leitura por daltônicos.
- **Produtos CEPEA:** lista `CEPEA` em `scripts/atualizar.py`.
