/**
 * App de Whey — back-end em Google Apps Script, vinculado à planilha.
 *
 * Publicação (RT-09): Implantar > Nova implantação > App da Web
 *   Executar como: Eu (dono) · Quem pode acessar: Qualquer pessoa
 *
 * Primeira vez: rode setup() no editor. Ele cria as abas, os valores padrão
 * da aba Config, gera o TOKEN nas Script Properties (veja em Execuções > Log)
 * e instala o gatilho do robô de coleta.
 *
 * API
 *   GET  ?token=…&acao=ping                         → { ok, versao, planilha, agora }
 *   GET  ?token=…&acao=bootstrap                    → { ok, dados: { produtos, lojas, monitores, cotacoes, config, minimos } }
 *   GET  ?token=…&acao=extrair&url=…                → { ok, previa: { nome, marca, peso_g, adaptador, skus, sku, preco, … } }
 *   GET  ?token=…&acao=coletar[&monitor_id=…][&antes=ISO] → { ok, coletados, restantes, resultados }
 *   POST (Content-Type text/plain) { token, ops: [{ op: 'upsert'|'delete', aba, id, dados }] } → { ok, aplicados }
 *
 * upsert por ID é idempotente: reenviar a mesma operação não duplica linhas (RT-06).
 * O robô (coletarTodos) roda pelo gatilho de tempo e grava uma cotação por monitor por dia (RP-11).
 */

const VERSAO = '1.1.0';

const ABAS = {
  Produtos: ['produto_id', 'marca', 'nome', 'tipo', 'sabor', 'peso_g', 'dose_g', 'proteina_dose_g', 'preco_alvo', 'ativo', 'obs',
    'proteina_laudo_g', 'laudo_fonte'],
  Lojas: ['loja_id', 'nome', 'tipo', 'url', 'plataforma', 'frete_fixo', 'frete_gratis_acima', 'desconto_pix_pct', 'cupom', 'cupom_pct', 'ativo'],
  Monitores: ['monitor_id', 'produto_id', 'loja_id', 'url', 'sku', 'sku_nome', 'adaptador', 'ativo', 'ultima_coleta', 'ultimo_preco',
    'ultimo_status', 'ultimo_erro', 'falhas_seguidas', 'alerta_enviado'],
  Cotacoes: ['cotacao_id', 'produto_id', 'loja_id', 'monitor_id', 'origem', 'data', 'preco', 'preco_min_dia', 'preco_lista', 'frete',
    'desconto', 'disponivel', 'url', 'obs', 'registrado_em'],
  ColetaLog: ['log_id', 'data', 'monitor_id', 'adaptador', 'http', 'resultado', 'preco', 'erro'],
  Config: ['chave', 'valor'],
};

// Guardadas como texto para o Sheets não converter datas ISO, IDs, SKUs e CEP.
const COLUNAS_TEXTO = ['data', 'ultima_coleta', 'registrado_em', 'sku', 'url', 'cupom', 'valor'];

const CONFIG_PADRAO = [
  ['intervalo_coleta_h', 6],
  ['janela_dias', 7],
  ['historico_dias', 180],
  ['cep', ''],
  ['email_alertas', 'sim'],
  ['falhas_para_pausar', 5],
  ['pausa_entre_req_ms', 2000],
  ['log_max_linhas', 2000],
];

const INTERVALOS = [1, 2, 4, 6, 8, 12]; // os que o gatilho everyHours aceita
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// ---------------------------------------------------------------- HTTP

function doGet(e) {
  return responder_(function () {
    const p = (e && e.parameter) || {};
    verificarToken_(p.token);
    const acao = p.acao || 'bootstrap';
    if (acao === 'ping') {
      return { versao: VERSAO, planilha: planilha_().getName(), agora: agoraIso_() };
    }
    if (acao === 'bootstrap') return { dados: bootstrap_() };
    if (acao === 'extrair') return { previa: extrair_(p.url) };
    if (acao === 'coletar') return coletar_({ monitor_id: p.monitor_id || '', antes: p.antes || '' }, 20000);
    throw new Error('Ação desconhecida: ' + acao);
  });
}

function doPost(e) {
  return responder_(function () {
    let corpo;
    try {
      corpo = JSON.parse(e.postData.contents);
    } catch (err) {
      throw new Error('Corpo JSON inválido');
    }
    verificarToken_(corpo.token);
    const ops = Array.isArray(corpo.ops) ? corpo.ops : [];
    const lock = LockService.getScriptLock(); // RT-13
    if (!lock.tryLock(30000)) throw new Error('Planilha ocupada, tente de novo');
    try {
      return { aplicados: aplicarOps_(ops) };
    } finally {
      lock.releaseLock();
    }
  });
}

function responder_(fn) {
  let out;
  try {
    out = Object.assign({ ok: true }, fn());
  } catch (err) {
    out = { ok: false, erro: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function verificarToken_(t) {
  const tok = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!tok) throw new Error('TOKEN não configurado nas Script Properties (rode setup())');
  if (!t || String(t) !== tok) throw new Error('Token inválido');
}

// ---------------------------------------------------------------- gravação

function aplicarOps_(ops) {
  const porAba = {};
  const ordem = [];
  ops.forEach(function (op, i) {
    if (!op || !ABAS[op.aba]) throw new Error('Operação ' + i + ': aba inválida');
    if (op.op !== 'upsert' && op.op !== 'delete') throw new Error('Operação ' + i + ': op inválida');
    if (op.id === undefined || op.id === null || op.id === '') throw new Error('Operação ' + i + ': id vazio');
    if (!porAba[op.aba]) { porAba[op.aba] = []; ordem.push(op.aba); }
    porAba[op.aba].push(op);
  });
  ordem.forEach(function (aba) { aplicarAba_(aba, porAba[aba]); });
  return ops.length;
}

/**
 * Aplica as operações de uma aba em memória e grava só o que mudou.
 * op.minimo (opcional): colunas que só aceitam valor menor que o atual (ex.: preco_min_dia).
 */
function aplicarAba_(nome, ops) {
  const sh = aba_(nome);
  const lastRow = sh.getLastRow();
  let lastCol = sh.getLastColumn();
  let header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const colId = header.indexOf(ABAS[nome][0]);
  if (colId < 0) throw new Error('Aba ' + nome + ' sem coluna ' + ABAS[nome][0] + ' (rode setup())');
  // Colunas criadas numa versão nova (ex.: proteina_laudo_g) entram no fim do cabeçalho sem precisar rodar setup()
  const faltam = ABAS[nome].filter(function (c) { return header.indexOf(c) < 0; });
  if (faltam.length) {
    sh.getRange(1, lastCol + 1, 1, faltam.length).setValues([faltam]);
    header = header.concat(faltam);
    lastCol += faltam.length;
  }
  const dados = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];

  const indice = {}; // id → { nova: bool, i }
  dados.forEach(function (r, i) { if (r[colId] !== '') indice[String(r[colId])] = { nova: false, i: i }; });
  const modificadas = {};
  const apagadas = {};
  const novas = [];

  ops.forEach(function (op) {
    const id = String(op.id);
    const ref = indice[id];
    if (op.op === 'delete') {
      if (ref) {
        if (ref.nova) novas[ref.i] = null;
        else { apagadas[ref.i] = true; delete modificadas[ref.i]; }
        delete indice[id];
      }
      return;
    }
    let linha;
    if (ref) {
      linha = ref.nova ? novas[ref.i] : dados[ref.i];
      if (!ref.nova) modificadas[ref.i] = true;
    } else {
      linha = header.map(function () { return ''; });
      novas.push(linha);
      indice[id] = { nova: true, i: novas.length - 1 };
    }
    linha[colId] = id;
    const d = op.dados || {};
    const minimo = op.minimo || [];
    Object.keys(d).forEach(function (k) {
      const c = header.indexOf(k);
      if (c < 0 || c === colId) return;
      if (minimo.indexOf(k) >= 0) {
        const atual = numero_(linha[c]), novo = numero_(d[k]);
        if (novo === null || (atual !== null && atual <= novo)) return;
      }
      linha[c] = valorCelula_(d[k]);
    });
  });

  Object.keys(modificadas).forEach(function (i) {
    sh.getRange(Number(i) + 2, 1, 1, lastCol).setValues([dados[i]]);
  });
  const add = novas.filter(Boolean);
  if (add.length) sh.getRange(lastRow + 1, 1, add.length, lastCol).setValues(add);
  Object.keys(apagadas).map(Number).sort(function (a, b) { return b - a; })
    .forEach(function (i) { sh.deleteRow(i + 2); });
}

function valorCelula_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v) && isNaN(Number(v))) return "'" + v; // evita fórmula injetada
  return v;
}

// ---------------------------------------------------------------- leitura

/**
 * O Google deixa negar cada permissão à parte (consentimento granular). O robô precisa de todas:
 * planilha, serviços externos (ler as lojas), e-mail e gatilhos. Faltando alguma, para aqui;
 * no editor, o Google mostra a tela de autorização de novo.
 */
function exigirPermissoes_() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
}

let PLANILHA_ = null;

/**
 * A planilha do app: a da propriedade PLANILHA_ID, se houver, ou a vinculada ao script.
 * PLANILHA_ID serve para projetos avulsos (criados em script.google.com) e não depende da aba ativa.
 */
function planilha_() {
  if (PLANILHA_) return PLANILHA_;
  const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error('Este projeto não está vinculado a uma planilha. Abra a planilha e use Extensões > Apps Script, ' +
      'ou crie a propriedade PLANILHA_ID (Configurações do projeto > Propriedades do script) com o ID que está no link da planilha.');
  }
  return (PLANILHA_ = ss);
}

function aba_(nome) {
  const sh = planilha_().getSheetByName(nome);
  if (!sh) throw new Error('Aba ' + nome + ' não existe (rode setup())');
  return sh;
}

function lerAba_(nome) {
  const sh = aba_(nome);
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const header = v[0].map(String);
  const colId = header.indexOf(ABAS[nome][0]);
  const tz = Session.getScriptTimeZone();
  const out = [];
  for (let r = 1; r < v.length; r++) {
    if (colId >= 0 && v[r][colId] === '') continue;
    const o = {};
    header.forEach(function (h, c) {
      if (!h) return;
      const x = v[r][c];
      o[h] = x instanceof Date ? Utilities.formatDate(x, tz, "yyyy-MM-dd'T'HH:mm:ssXXX") : x;
    });
    out.push(o);
  }
  return out;
}

function lerConfig_() {
  const c = {};
  CONFIG_PADRAO.forEach(function (p) { c[p[0]] = p[1]; });
  lerAba_('Config').forEach(function (r) { if (r.valor !== '') c[r.chave] = r.valor; });
  return c;
}

function indexar_(lista, chave) {
  const o = {};
  lista.forEach(function (x) { o[String(x[chave])] = x; });
  return o;
}

function bootstrap_() {
  const config = lerConfig_();
  const lojas = lerAba_('Lojas');
  const porLoja = indexar_(lojas, 'loja_id');
  const limite = agoraIso_(Date.now() - (numero_(config.historico_dias) || 180) * 864e5);

  // Menor custo efetivo já visto por produto, sobre todo o histórico (RP-19)
  const minimos = {};
  const cotacoes = [];
  lerAba_('Cotacoes').forEach(function (c) {
    const menor = numero_(c.preco_min_dia) !== null ? c.preco_min_dia : c.preco;
    const ce = custoEfetivo_({ preco: menor, frete: c.frete, desconto: c.desconto, disponivel: true }, porLoja[c.loja_id]);
    const m = minimos[c.produto_id];
    if (ce && (!m || ce.custo < m.custo)) minimos[c.produto_id] = { custo: ce.custo, data: c.data, loja_id: c.loja_id };
    if (String(c.data) < limite) return;
    // Cache local enxuto (RT-07): campos vazios não vão para o celular
    const o = {};
    Object.keys(c).forEach(function (k) { if (c[k] !== '') o[k] = c[k]; });
    cotacoes.push(o);
  });

  return {
    produtos: lerAba_('Produtos'),
    lojas: lojas,
    monitores: lerAba_('Monitores'),
    cotacoes: cotacoes,
    config: config,
    minimos: minimos,
    servidor: agoraIso_(),
  };
}

function agoraIso_(ms) {
  return Utilities.formatDate(ms ? new Date(ms) : new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// ---------------------------------------------------------------- funções puras (testadas em testes/rodar.js)

function numero_(x) {
  if (x === '' || x === null || x === undefined) return null;
  if (typeof x === 'number') return isFinite(x) ? x : null;
  let s = String(x).replace(/[^\d.,-]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function bool_(x, padrao) {
  if (x === '' || x === null || x === undefined) return !!padrao;
  return x === true || x === 1 || /^(true|sim|1|verdadeiro)$/i.test(String(x));
}

const arred_ = function (x) { return Math.round(x * 100) / 100; };

/**
 * Custo efetivo (RP-07): preço − desconto + frete. Quando a cotação não informa frete ou desconto,
 * valem as regras da loja. Mesma regra de custoEfetivo() do index.html (rodar.js confere).
 * → { preco, desconto, frete, custo } ou null se indisponível / sem preço
 */
function custoEfetivo_(c, loja) {
  const preco = numero_(c.preco);
  if (preco === null || preco <= 0 || !bool_(c.disponivel, true)) return null;
  loja = loja || {};
  let desconto = numero_(c.desconto);
  if (desconto === null) {
    const cupom = numero_(loja.cupom_pct) || 0, pix = numero_(loja.desconto_pix_pct) || 0;
    desconto = preco - preco * (1 - cupom / 100) * (1 - pix / 100);
  }
  let frete = numero_(c.frete);
  if (frete === null) {
    const gratis = numero_(loja.frete_gratis_acima);
    frete = gratis !== null && preco - desconto >= gratis ? 0 : numero_(loja.frete_fixo) || 0;
  }
  return { preco: preco, desconto: arred_(desconto), frete: arred_(frete), custo: arred_(preco - desconto + frete) };
}

/** Peso em gramas a partir do título: "900g" → 900, "1,8 kg" → 1800, "Kit 2X … 900G" → 1800. */
function pesoDoTitulo_(t) {
  t = String(t || '').toLowerCase();
  const re = /(\d+(?:[.,]\d+)?)\s*(kg|g)(?![a-z])/g;
  let m, g = null;
  while ((m = re.exec(t))) {
    const v = parseFloat(m[1].replace(',', '.')) * (m[2] === 'kg' ? 1000 : 1);
    if (g === null || v > g) g = v; // a maior medida é a embalagem (não a dose)
  }
  if (g === null) return null;
  const kit = t.match(/(?:^|[\s(])([2-9])\s*x(?![a-z])/);
  return Math.round(g * (kit ? Number(kit[1]) : 1));
}

function decodificarHtml_(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); })
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').trim();
}

/** Separa origem, caminho e query sem a classe URL (o Apps Script não tem). */
function partirUrl_(url) {
  const m = String(url || '').trim().match(/^(https?:\/\/[^\/?#]+)([^?#]*)(\?[^#]*)?/i);
  if (!m) throw new Error('Link inválido (precisa começar com http:// ou https://)');
  return { origem: m[1].toLowerCase(), caminho: m[2] || '/', query: m[3] || '' };
}

function parametro_(query, nome) {
  const m = String(query || '').match(new RegExp('[?&]' + nome + '=([^&#]*)', 'i'));
  return m ? decodeURIComponent(m[1]) : '';
}

/**
 * Tentativas de leitura de um link, do adaptador mais estável ao mais frágil (RT-16).
 * O adaptador que funcionou da última vez vai primeiro.
 * → [{ adaptador: 'vtex'|'shopify'|'html', url, sku }]
 */
function planoDeColeta_(url, adaptador) {
  const u = partirUrl_(url);
  const t = [];
  if (/\/p\/?$/.test(u.caminho)) {
    t.push({ adaptador: 'vtex', url: u.origem + '/api/catalog_system/pub/products/search' + u.caminho.replace(/\/p\/?$/, '/p'),
      sku: parametro_(u.query, 'skuId') });
  }
  const sh = u.caminho.match(/\/products\/([^\/]+)\/?$/);
  if (sh) t.push({ adaptador: 'shopify', url: u.origem + '/products/' + sh[1].replace(/\.js(on)?$/, '') + '.js', sku: parametro_(u.query, 'variant') });
  t.push({ adaptador: 'html', url: String(url).trim(), sku: '' });
  const i = t.map(function (x) { return x.adaptador; }).indexOf(adaptador === 'jsonld' || adaptador === 'meta' ? 'html' : adaptador);
  if (i > 0) t.unshift(t.splice(i, 1)[0]);
  return t;
}

/**
 * Escolhe o SKU acompanhado e monta a prévia. Sem SKU pedido, fica o primeiro disponível.
 * skus: [{ sku, nome, preco, preco_lista, disponivel, seller }]
 */
function montarPrevia_(nome, marca, skus, sku) {
  if (!skus.length) return null;
  let alvo;
  if (sku) {
    alvo = skus.filter(function (s) { return String(s.sku) === String(sku); })[0];
    if (!alvo) {
      if (skus.length > 1) throw new Error('O sabor escolhido (SKU ' + sku + ') não está mais na página');
      alvo = skus[0]; // página de um SKU só: o código pode ter mudado
    }
  } else {
    alvo = skus.filter(function (s) { return s.disponivel; })[0] || skus[0];
  }
  return {
    nome: decodificarHtml_(nome), marca: decodificarHtml_(marca), skus: skus,
    sku: String(alvo.sku), sku_nome: alvo.nome || '', preco: alvo.preco, preco_lista: alvo.preco_lista,
    disponivel: !!alvo.disponivel, seller: alvo.seller || '',
    peso_g: pesoDoTitulo_(nome + ' ' + (alvo.nome || '')),
  };
}

/** Resposta da API pública de catálogo VTEX (array de produtos). */
function extrairVtex_(arr, sku) {
  const p = Array.isArray(arr) ? arr[0] : null;
  if (!p || !Array.isArray(p.items)) return null;
  const skus = p.items.map(function (it) {
    const vendedores = it.sellers || [];
    const sel = vendedores.filter(function (s) { return s.sellerDefault; })[0] || vendedores[0] || {};
    const o = sel.commertialOffer || {};
    const preco = numero_(o.Price);
    const disp = o.IsAvailable !== false && (numero_(o.AvailableQuantity) || 0) > 0 && preco > 0;
    return { sku: String(it.itemId), nome: it.name || '', preco: preco > 0 ? preco : null, preco_lista: numero_(o.ListPrice),
      disponivel: disp, seller: String(sel.sellerId || '1') };
  });
  return montarPrevia_(p.productName, p.brand, skus, sku);
}

/** Resposta de /products/<handle>.js de uma loja Shopify (preços em centavos). */
function extrairShopify_(p, sku) {
  if (!p || !Array.isArray(p.variants)) return null;
  const skus = p.variants.map(function (v) {
    return { sku: String(v.id), nome: v.title === 'Default Title' ? '' : v.title || '', preco: numero_(v.price) / 100,
      preco_lista: v.compare_at_price ? numero_(v.compare_at_price) / 100 : null, disponivel: !!v.available };
  });
  return montarPrevia_(p.title, p.vendor, skus, sku);
}

function percorrerLd_(j, out, herda) {
  if (Array.isArray(j)) { j.forEach(function (x) { percorrerLd_(x, out, herda); }); return; }
  if (!j || typeof j !== 'object') return;
  if (j['@graph']) percorrerLd_(j['@graph'], out, herda);
  const tipo = [].concat(j['@type'] || []).join(' ');
  if (/\bProductGroup\b/.test(tipo)) {
    percorrerLd_(j.hasVariant || [], out, { brand: j.brand, grupo: j.name });
  } else if (/\bProduct\b/.test(tipo)) {
    out.push(Object.assign({}, herda || {}, j));
  }
}

function disponibilidadeLd_(a) {
  if (!a) return null;
  if (/OutOfStock|SoldOut|Discontinued/i.test(a)) return false;
  return /InStock|InStoreOnly|LimitedAvailability|OnlineOnly|PreOrder|PreSale/i.test(a) ? true : null;
}

/** Link sem protocolo, www, query, âncora e barra final, para comparar o produto com a página. */
function chaveUrl_(u) {
  return String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}

/**
 * JSON-LD schema.org Product / ProductGroup com Offer ou AggregateOffer.
 * Com urlPagina: produtos que declaram outro link (vitrines de relacionados) são ignorados,
 * para não gravar o preço de outro produto.
 */
function extrairJsonLd_(html, sku, urlPagina) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let produtos = [];
  let m;
  while ((m = re.exec(html))) {
    try { percorrerLd_(JSON.parse(m[1].trim()), produtos); } catch (e) { /* bloco inválido: ignora */ }
  }
  if (urlPagina) {
    const pagina = chaveUrl_(urlPagina);
    produtos = produtos.filter(function (p) {
      // Só url e o link da oferta: @id é identificador e às vezes aponta para outro site do grupo (ex.: Sam's → Carrefour)
      const links = [p.url].concat([].concat(p.offers || []).map(function (o) { return o && o.url; }))
        .filter(Boolean).map(chaveUrl_);
      return !links.length || links.some(function (l) { return l === pagina || l.indexOf(pagina + '#') === 0; });
    });
  }
  const skus = [];
  let nome = '', marca = '';
  produtos.forEach(function (p, i) {
    const b = p.brand && (p.brand.name || p.brand);
    if (!nome) nome = p.grupo || p.name || '';
    if (!marca && typeof b === 'string') marca = b;
    [].concat(p.offers || []).forEach(function (o, k) {
      const lista = /AggregateOffer/.test([].concat(o['@type'] || []).join(' ')) && o.offers ? [].concat(o.offers) : [o];
      lista.forEach(function (x, j) {
        const preco = numero_(x.price !== undefined ? x.price : x.lowPrice !== undefined ? x.lowPrice : (x.priceSpecification || {}).price);
        if (preco === null) return;
        const d = disponibilidadeLd_(x.availability);
        skus.push({ sku: String(x.sku || p.sku || p.productID || i + '.' + k + '.' + j), nome: p.grupo ? p.name || '' : '',
          preco: preco, preco_lista: null, disponivel: d === null ? preco > 0 : d });
      });
    });
  });
  return montarPrevia_(nome, marca, skus, sku);
}

/** Metatags product:price:amount, og:price:amount e itemprop="price" (último recurso). */
function extrairMeta_(html, sku) {
  const meta = {};
  (String(html).match(/<meta\b[^>]*>/gi) || []).forEach(function (tag) {
    const at = {};
    tag.replace(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, function (_, k, __, a, b) { at[k.toLowerCase()] = a !== undefined ? a : b; });
    const chave = (at.property || at.name || at.itemprop || '').toLowerCase();
    if (chave && at.content !== undefined && meta[chave] === undefined) meta[chave] = at.content;
  });
  let preco = numero_(meta['product:price:amount'] || meta['og:price:amount'] || meta.price);
  if (preco === null) {
    const ip = String(html).match(/itemprop=["']price["'][^>]*content=["']([^"']+)/i);
    if (ip) preco = numero_(ip[1]);
  }
  if (preco === null) return null;
  const titulo = meta['og:title'] || (String(html).match(/<title[^>]*>([^<]*)/i) || [])[1] || '';
  const disp = meta['product:availability'] || meta['og:availability'] || '';
  return montarPrevia_(titulo, meta['product:brand'] || meta['og:brand'] || '',
    [{ sku: sku || '', nome: '', preco: preco, preco_lista: null, disponivel: !/out.?of.?stock|oos|indispon|esgotad/i.test(disp) }], sku);
}

/** Aplica o adaptador ao texto baixado. 'html' tenta JSON-LD (só do produto da página) e depois metatags. */
function extrairDe_(adaptador, texto, sku, urlPagina) {
  if (adaptador === 'vtex' || adaptador === 'shopify') {
    let j;
    try { j = JSON.parse(texto); } catch (e) { return null; }
    const p = adaptador === 'vtex' ? extrairVtex_(j, sku) : extrairShopify_(j, sku);
    return p && Object.assign(p, { adaptador: adaptador });
  }
  const ld = extrairJsonLd_(texto, sku, urlPagina);
  if (ld) return Object.assign(ld, { adaptador: 'jsonld' });
  const mt = extrairMeta_(texto, sku);
  return mt && Object.assign(mt, { adaptador: 'meta' });
}

/** Menor frete (R$) entre as opções de entrega de uma simulação de carrinho VTEX; null se não houver. */
function freteDaSimulacao_(j) {
  const slas = ((((j || {}).logisticsInfo || [])[0]) || {}).slas || [];
  const entrega = slas.filter(function (s) { return s.deliveryChannel !== 'pickup-in-point'; });
  if (!entrega.length) return null;
  return Math.min.apply(null, entrega.map(function (s) { return numero_(s.price) || 0; })) / 100;
}

// ---------------------------------------------------------------- coleta (RT-15..RT-21)

const ULTIMO_ACESSO_ = {}; // host → ms, só dentro de uma execução

/** UrlFetchApp com pausa mínima entre requisições ao mesmo host (RT-15). */
function buscar_(url, opcoes) {
  const host = partirUrl_(url).origem;
  const pausa = numero_(lerConfigCache_().pausa_entre_req_ms) || 2000;
  const espera = (ULTIMO_ACESSO_[host] || 0) + pausa - Date.now();
  if (espera > 0) Utilities.sleep(espera);
  ULTIMO_ACESSO_[host] = Date.now();
  return UrlFetchApp.fetch(url, Object.assign({
    muteHttpExceptions: true, followRedirects: true,
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
  }, opcoes || {}));
}

let CONFIG_CACHE_ = null;
function lerConfigCache_() { return CONFIG_CACHE_ || (CONFIG_CACHE_ = lerConfig_()); }

/** Lê um link pelos adaptadores, em ordem. → prévia com .adaptador e .http; lança erro com .http se nada funcionar. */
function coletarUrl_(url, sku, adaptador) {
  let erro = 'Nenhum adaptador reconheceu o preço na página', http = '';
  const tentativas = planoDeColeta_(url, adaptador);
  for (let i = 0; i < tentativas.length; i++) {
    const t = tentativas[i];
    const r = buscar_(t.url);
    http = r.getResponseCode();
    if (http === 403 || http === 429 || http === 503) { erro = 'Bloqueado pela loja (HTTP ' + http + ')'; continue; }
    if (http >= 400) { erro = 'HTTP ' + http; continue; }
    const p = extrairDe_(t.adaptador, r.getContentText(), sku || t.sku, url); // erro de SKU sobe direto
    if (p && (p.preco !== null || !p.disponivel)) return Object.assign(p, { http: http });
  }
  const e = new Error(erro);
  e.http = http;
  throw e;
}

/** Frete real para o CEP pela simulação pública VTEX (RT-18). Bloqueio fica 6 h em cache para não insistir. */
function simularFreteVtex_(url, sku, seller, cep) {
  cep = String(cep || '').replace(/\D/g, '');
  if (cep.length !== 8 || !sku) return null;
  const origem = partirUrl_(url).origem;
  const cache = CacheService.getScriptCache();
  const k = 'simbloq_' + origem;
  if (cache.get(k)) return null;
  try {
    const r = buscar_(origem + '/api/checkout/pub/orderForms/simulation', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ items: [{ id: String(sku), quantity: 1, seller: seller || '1' }], postalCode: cep, country: 'BRA' }),
    });
    if (r.getResponseCode() !== 200) { cache.put(k, '1', 21600); return null; }
    return freteDaSimulacao_(JSON.parse(r.getContentText()));
  } catch (e) {
    return null;
  }
}

/** Prévia de um link colado no app (RP-08). */
function extrair_(url) {
  if (!url) throw new Error('Informe o link');
  exigirPermissoes_();
  CONFIG_CACHE_ = null;
  const p = coletarUrl_(url, '', '');
  p.host = partirUrl_(url).origem;
  return p;
}

/**
 * Coleta monitores, do mais antigo para o mais novo, até o orçamento de tempo (RT-19).
 * filtro.monitor_id: só esse (mesmo pausado) · filtro.antes: só os coletados antes desse instante ISO
 * → { coletados, restantes, resultados: [{ monitor_id, status, preco, erro }] }
 */
function coletar_(filtro, limiteMs) {
  exigirPermissoes_(); // sem permissão a rodada para aqui, sem contar falha nos links
  const inicio = Date.now();
  const config = CONFIG_CACHE_ = lerConfig_();
  const produtos = indexar_(lerAba_('Produtos'), 'produto_id');
  const lojas = indexar_(lerAba_('Lojas'), 'loja_id');
  const fila = lerAba_('Monitores').filter(function (m) {
    if (filtro.monitor_id) return String(m.monitor_id) === String(filtro.monitor_id);
    return bool_(m.ativo, true) && (!filtro.antes || String(m.ultima_coleta || '') < filtro.antes);
  }).sort(function (a, b) { return String(a.ultima_coleta || '') < String(b.ultima_coleta || '') ? -1 : 1; });

  const ops = [], alertas = [], resultados = [];
  let feitos = 0;
  for (; feitos < fila.length; feitos++) {
    if (Date.now() - inicio > limiteMs) break;
    const r = coletarMonitor_(fila[feitos], produtos, lojas, config);
    Array.prototype.push.apply(ops, r.ops);
    Array.prototype.push.apply(alertas, r.alertas);
    resultados.push(r.resultado);
  }
  if (ops.length) gravarColeta_(ops, numero_(config.log_max_linhas) || 2000);
  enviarAlertas_(alertas, config);
  return { coletados: feitos, restantes: fila.length - feitos, resultados: resultados };
}

/** Uma visita a um monitor → operações de gravação, alertas e resultado. Não grava nada. */
function coletarMonitor_(m, produtos, lojas, config) {
  const agora = agoraIso_();
  const mid = String(m.monitor_id);
  const produto = produtos[m.produto_id] || {};
  const loja = lojas[m.loja_id] || {};
  const nomeProd = [produto.marca, produto.nome].filter(Boolean).join(' ') || '(produto removido)';
  const ops = [], alertas = [];
  let p = null, erro = null, http = '';
  try {
    p = coletarUrl_(m.url, m.sku, m.adaptador);
    http = p.http;
  } catch (e) {
    erro = String(e.message || e);
    http = e.http || '';
  }

  const mon = { ultima_coleta: agora };
  if (p) {
    const frete = p.adaptador === 'vtex' && p.disponivel ? simularFreteVtex_(m.url, p.sku, p.seller, config.cep) : null;
    const preco = p.disponivel ? p.preco : '';
    const cot = {
      produto_id: m.produto_id, loja_id: m.loja_id, monitor_id: mid, origem: 'auto', data: agora,
      preco: preco, preco_min_dia: preco, preco_lista: p.preco_lista, frete: frete === null ? '' : frete, desconto: '',
      disponivel: p.disponivel, registrado_em: agora,
    };
    ops.push({ op: 'upsert', aba: 'Cotacoes', id: 'auto_' + mid + '_' + agora.slice(0, 10), dados: cot, minimo: ['preco_min_dia'], ref: mid });
    Object.assign(mon, { ultimo_preco: preco, ultimo_status: p.disponivel ? 'ok' : 'indisponivel', ultimo_erro: '', falhas_seguidas: 0,
      adaptador: p.adaptador });
    if (m.ultimo_status === 'pausado') mon.ativo = true; // coletar agora num monitor pausado o reativa
    // Link cadastrado sem sabor: trava o que foi lido agora, para não trocar de sabor quando ele acabar
    if (!m.sku && p.sku) Object.assign(mon, { sku: p.sku, sku_nome: p.sku_nome });

    // Alerta de preço-alvo, uma vez por queda (RP-22)
    const ce = custoEfetivo_(cot, loja);
    const alvo = numero_(produto.preco_alvo);
    if (ce && alvo > 0) {
      if (ce.custo <= alvo && !bool_(m.alerta_enviado)) {
        mon.alerta_enviado = true;
        alertas.push('🏷️ ' + nomeProd + ' em ' + (loja.nome || '?') + ': ' + reais_(ce.custo) + ' (alvo ' + reais_(alvo) + ')\n   ' + m.url);
      } else if (ce.custo > alvo && bool_(m.alerta_enviado)) {
        mon.alerta_enviado = false;
      }
    }
  } else {
    const falhas = (numero_(m.falhas_seguidas) || 0) + 1;
    const pausar = falhas >= (numero_(config.falhas_para_pausar) || 5) && bool_(m.ativo, true);
    Object.assign(mon, { ultimo_status: pausar || m.ultimo_status === 'pausado' ? 'pausado' : 'erro', ultimo_erro: erro, falhas_seguidas: falhas });
    if (pausar) {
      mon.ativo = false;
      alertas.push('⚠️ Monitor pausado após ' + falhas + ' falhas: ' + nomeProd + ' em ' + (loja.nome || '?') + '\n   ' + erro + '\n   ' + m.url);
    }
  }
  ops.push({ op: 'upsert', aba: 'Monitores', id: mid, dados: mon, ref: mid });
  ops.push({ op: 'upsert', aba: 'ColetaLog', id: Utilities.getUuid(), dados: {
    data: agora, monitor_id: mid, adaptador: p ? p.adaptador : '', http: http,
    resultado: p ? (p.disponivel ? 'ok' : 'indisponivel') : 'erro', preco: p && p.disponivel ? p.preco : '', erro: erro || '' } });
  return { ops: ops, alertas: alertas, resultado: { monitor_id: mid, status: mon.ultimo_status, preco: p ? p.preco : null, erro: erro } };
}

/** Grava o resultado da coleta sob o mesmo lock do app (RT-13), ignorando monitores apagados no meio do caminho. */
function gravarColeta_(ops, maxLog) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Planilha ocupada, coleta não gravada');
  try {
    const existe = indexar_(lerAba_('Monitores'), 'monitor_id');
    aplicarOps_(ops.filter(function (o) { return !o.ref || existe[o.ref]; }));
    const sh = aba_('ColetaLog');
    const n = sh.getLastRow() - 1;
    if (n > maxLog) sh.deleteRows(2, n - maxLog); // RT-21: as mais antigas estão no topo
  } finally {
    lock.releaseLock();
  }
}

function reais_(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

function enviarAlertas_(alertas, config) {
  if (!alertas.length || !bool_(config.email_alertas, true)) return;
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Whey: ' + alertas.length + ' aviso(s) do robô de preços',
      alertas.join('\n\n') + '\n\nPlanilha: ' + planilha_().getUrl());
  } catch (e) {
    Logger.log('Falha ao enviar e-mail: ' + e.message); // cota de e-mail esgotada não derruba a coleta
  }
}

/** Rodada do gatilho (RT-19): coleta até ~4,5 min e reinstala o gatilho se o intervalo mudou na Config. */
function coletarTodos() {
  const h = intervaloValido_(lerConfig_().intervalo_coleta_h);
  if (PropertiesService.getScriptProperties().getProperty('INTERVALO') !== String(h)) instalarGatilho();
  const r = coletar_({}, 270000);
  Logger.log('Coletados: ' + r.coletados + ' · restantes: ' + r.restantes);
  r.resultados.forEach(function (x) { Logger.log(x.status + ' ' + x.monitor_id + ' ' + (x.preco || '') + ' ' + (x.erro || '')); });
}

function intervaloValido_(h) {
  h = numero_(h) || 6;
  return INTERVALOS.reduce(function (a, b) { return Math.abs(b - h) < Math.abs(a - h) ? b : a; });
}

// ---------------------------------------------------------------- manutenção (rodar no editor)

/** Cria/atualiza abas, cabeçalhos, formatos, Config padrão, TOKEN e gatilho. Pode rodar várias vezes. */
function setup() {
  exigirPermissoes_();
  const ss = planilha_();
  Object.keys(ABAS).forEach(function (nome) {
    // Índice explícito: insertSheet(nome) insere após a aba ativa e falha ("Planilha 0 não encontrada") se ela não existir
    const sh = ss.getSheetByName(nome) || ss.insertSheet(nome, ss.getSheets().length);
    const cols = ABAS[nome];
    const lastCol = sh.getLastColumn();
    const atuais = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    if (!atuais.filter(String).length) {
      sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    } else {
      const faltam = cols.filter(function (c) { return atuais.indexOf(c) < 0; });
      if (faltam.length) sh.getRange(1, lastCol + 1, 1, faltam.length).setValues([faltam]);
    }
    const n = sh.getLastColumn();
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, n).setFontWeight('bold');
    const header = sh.getRange(1, 1, 1, n).getValues()[0].map(String);
    header.forEach(function (h, i) {
      if (COLUNAS_TEXTO.indexOf(h) >= 0 || /_id$/.test(h)) {
        sh.getRange(2, i + 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');
      }
    });
  });
  const padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (padrao && padrao.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(padrao);

  const existentes = lerAba_('Config').map(function (r) { return r.chave; });
  const faltam = CONFIG_PADRAO.filter(function (c) { return existentes.indexOf(c[0]) < 0; });
  if (faltam.length) {
    aplicarOps_(faltam.map(function (c) { return { op: 'upsert', aba: 'Config', id: c[0], dados: { valor: c[1] } }; }));
  }

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN')) props.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));
  instalarGatilho();
  Logger.log('TOKEN (cole no app): ' + props.getProperty('TOKEN'));
}

/** (Re)instala o gatilho de tempo do robô com o intervalo da aba Config. */
function instalarGatilho() {
  const h = intervaloValido_(lerConfig_().intervalo_coleta_h);
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'coletarTodos'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('coletarTodos').timeBased().everyHours(h).create();
  PropertiesService.getScriptProperties().setProperty('INTERVALO', String(h));
  Logger.log('Gatilho instalado: coletarTodos a cada ' + h + ' h');
}

/** Gera um novo TOKEN (o app precisará ser reconfigurado). */
function trocarToken() {
  const t = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('TOKEN', t);
  Logger.log('Novo TOKEN: ' + t);
}

/**
 * Opcional: carrega lojas, produtos e monitores de exemplo, se o catálogo estiver vazio.
 * Os valores nutricionais são ilustrativos: confira no rótulo antes de confiar no ranking.
 */
function seedExemplo() {
  if (lerAba_('Produtos').length) { Logger.log('Catálogo não está vazio; nada feito.'); return; }
  const id = function () { return Utilities.getUuid(); };
  const L = { max: id(), probiotica: id(), growth: id(), fisica: id() };
  // Growth: o preço publicado é o do cartão; no PIX sai 10 % mais barato
  const ops = [
    ['max', 'Max Titanium', 'online', 'https://www.maxtitanium.com.br', 'vtex', ''],
    ['probiotica', 'Probiótica', 'online', 'https://www.probiotica.com.br', 'vtex', ''],
    ['growth', 'Growth Supplements', 'online', 'https://www.gsuplementos.com.br', 'outra', 10],
    ['fisica', 'Loja do bairro', 'fisica', '', 'outra', ''],
  ].map(function (l) {
    return { op: 'upsert', aba: 'Lojas', id: L[l[0]], dados: { nome: l[1], tipo: l[2], url: l[3], plataforma: l[4], desconto_pix_pct: l[5], ativo: true } };
  });
  // Growth: a página tem 450 g, 750 g e 900 g, mas o preço que ela publica para robôs é o do tamanho pré-selecionado (450 g)
  const exemplos = [
    ['Max Titanium', 'IsoWhey', 'isolado', 'Chocolate', 900, 30, 27, 'max', 'https://www.maxtitanium.com.br/iso-whey-900g-max-titanium/p', '62'],
    ['Probiótica', '100% Pure Whey', 'concentrado', '', 900, 30, 20, 'probiotica', 'https://www.probiotica.com.br/100-pure-whey-pote-900g/p', ''],
    ['Growth', '100% Whey Protein Concentrado 450 g', 'concentrado', 'Chocolate', 450, 30, 24, 'growth', 'https://www.gsuplementos.com.br/100-whey-protein-concentrado-chocolate', ''],
  ];
  exemplos.forEach(function (e) {
    const pid = id();
    ops.push({ op: 'upsert', aba: 'Produtos', id: pid, dados: {
      marca: e[0], nome: e[1], tipo: e[2], sabor: e[3], peso_g: e[4], dose_g: e[5], proteina_dose_g: e[6], ativo: true,
      obs: 'Exemplo: confira peso, dose e proteína no rótulo' } });
    ops.push({ op: 'upsert', aba: 'Monitores', id: id(), dados: { produto_id: pid, loja_id: L[e[7]], url: e[8], sku: e[9], ativo: true } });
  });
  aplicarOps_(ops);
  Logger.log('Exemplo carregado: ' + ops.length + ' linhas. Rode testarColeta para ver o que o robô consegue ler.');
}

/** Teste de fumaça da gravação: upsert idempotente, merge, mínimo, delete e bootstrap. */
function testarApi() {
  const id = '__teste_' + Date.now();
  const linhas = function () { return lerAba_('Config').filter(function (r) { return r.chave === id; }); };
  const ok = function (cond, msg) { if (!cond) throw new Error('FALHOU: ' + msg); Logger.log('ok — ' + msg); };

  aplicarOps_([{ op: 'upsert', aba: 'Config', id: id, dados: { valor: 1 } }]);
  ok(linhas().length === 1 && Number(linhas()[0].valor) === 1, 'upsert cria linha');
  aplicarOps_([{ op: 'upsert', aba: 'Config', id: id, dados: { valor: 2 } }, { op: 'upsert', aba: 'Config', id: id, dados: { valor: 3 } }]);
  ok(linhas().length === 1 && Number(linhas()[0].valor) === 3, 'upsert repetido não duplica');
  aplicarOps_([{ op: 'upsert', aba: 'Config', id: id, dados: { valor: 5 }, minimo: ['valor'] }]);
  ok(Number(linhas()[0].valor) === 3, 'coluna de mínimo não aceita valor maior');
  aplicarOps_([{ op: 'delete', aba: 'Config', id: id }, { op: 'delete', aba: 'Config', id: id }]);
  ok(linhas().length === 0, 'delete remove (e repetir é seguro)');
  aplicarOps_([{ op: 'upsert', aba: 'Config', id: id, dados: { valor: '=1+1' } }]);
  ok(linhas()[0].valor === '=1+1', 'fórmula é gravada como texto, não calculada');
  aplicarOps_([{ op: 'delete', aba: 'Config', id: id }]);
  const b = bootstrap_();
  ok(Array.isArray(b.produtos) && Array.isArray(b.cotacoes) && typeof b.minimos === 'object', 'bootstrap responde');
  Logger.log('Todos os testes passaram.');
}

/** Lê cada monitor sem gravar nada: mostra no log o que o robô consegue extrair a partir dos servidores do Google. */
function testarColeta() {
  exigirPermissoes_();
  lerAba_('Monitores').forEach(function (m) {
    try {
      const p = coletarUrl_(m.url, m.sku, m.adaptador);
      Logger.log('ok [' + p.adaptador + ' ' + p.http + '] ' + p.nome + ' · ' + (p.sku_nome || p.sku) + ' · ' +
        (p.disponivel ? reais_(p.preco) : 'indisponível') + ' · ' + m.url);
    } catch (e) {
      Logger.log('ERRO [' + (e.http || '-') + '] ' + e.message + ' · ' + m.url);
    }
  });
}
