// Roda os testes no Node, sem navegador: node testes/rodar.js
// 1. Extrai o bloco <núcleo> e a função rodarTestes() do HTML e executa.
// 2. Roda o Code.gs de verdade numa planilha em memória (testes/gas-falso.js): extratores com as
//    páginas de testes/fixtures, gravação, robô de coleta, alertas e API.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { criarGas, isoBrasilia } = require('./gas-falso');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

// O script inteiro precisa compilar, e o Code.gs também
new vm.Script(script, { filename: 'index.html' });
new vm.Script(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8'), { filename: 'Code.gs' });

const nucleo = script.match(/\/\/ <núcleo>[^\n]*\n([\s\S]*?)\/\/ <\/núcleo>/)[1];
const testes = script.match(/(function rodarTestes\(\) \{[\s\S]*?\n\})\n/)[1];
const ctx = { console, $: () => ({}), esc: s => String(s) };
vm.createContext(ctx);
vm.runInContext(nucleo + '\n' + testes + '\nthis.res = rodarTestes();', ctx);

const res = ctx.res.map(r => ({ ...r, nome: 'núcleo: ' + r.nome }));
const t = (nome, cond, info) => res.push({ nome: 'Code.gs: ' + nome, ok: !!cond, info });
const lanca = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const tenta = fn => { try { return fn(); } catch (e) { return { erro: e.message }; } };
const fx = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

// ---------------------------------------------------------------- extratores (funções puras)
{
  const { gs } = criarGas();
  const vtex = JSON.parse(fx('vtex-produto.json'));
  let p = gs.extrairVtex_(vtex, '');
  t('VTEX: sem sabor escolhido, o primeiro disponível', p.sku === '64' && p.preco === 326.18 && p.preco_lista === 359.9 && p.disponivel &&
    p.marca === 'Max Titanium' && p.peso_g === 900 && p.skus.length === 3 && p.seller === '1', p);
  p = gs.extrairVtex_(vtex, '62'); t('VTEX: sabor escolhido', p.sku === '62' && p.sku_nome === 'Chocolate' && p.preco === 319.9, p);
  p = gs.extrairVtex_(vtex, '63'); t('VTEX: sabor esgotado', p.disponivel === false && p.preco === null, p);
  t('VTEX: sabor que sumiu da página é erro', lanca(() => gs.extrairVtex_(vtex, '99'), /sabor escolhido/));
  t('VTEX: resposta vazia → null', gs.extrairVtex_([], '') === null && gs.extrairDe_('vtex', '<html>', '') === null);

  const shop = JSON.parse(fx('shopify-produto.json'));
  p = gs.extrairShopify_(shop, '');
  t('Shopify: preço em centavos, kit 2 × 900 g', p.sku === '4001' && p.preco === 377.56 && p.preco_lista === 419.9 && p.peso_g === 1800 && p.marca === 'Dark Lab', p);
  p = gs.extrairShopify_(shop, '4002'); t('Shopify: variante esgotada', p.disponivel === false, p);

  p = gs.extrairDe_('html', fx('jsonld-oferta.html'), '');
  t('JSON-LD: Product + Offer (ignora blocos inválidos e outras entidades)', p.adaptador === 'jsonld' && p.preco === 83.22 && p.marca === 'Growth Supplements' &&
    p.nome === '100% Whey Protein Concentrado (1kg)' && p.peso_g === 1000 && p.disponivel, p);
  p = gs.extrairDe_('html', fx('jsonld-grupo.html'), '');
  t('JSON-LD: @graph com ProductGroup e variantes', p.nome === 'Whey Gold Standard 907g' && p.marca === 'Optimum Nutrition' && p.sku === 'WG-CHO' &&
    p.preco === 289.9 && p.skus.length === 2 && p.peso_g === 907, p);
  p = gs.extrairDe_('html', fx('jsonld-grupo.html'), 'WG-BAU');
  t('JSON-LD: variante OutOfStock e preço com vírgula', p.disponivel === false && p.preco === 279.9 && p.sku_nome === 'Baunilha', p);
  p = gs.extrairDe_('html', fx('jsonld-agregado.html'), '');
  t('JSON-LD: AggregateOffer usa o lowPrice', p.preco === 149.9 && p.marca === 'Marca X' && p.peso_g === 2000 && p.disponivel, p);
  p = gs.extrairDe_('html', fx('meta-oferta.html'), '');
  t('metatags: preço, título com entidades e marca', p.adaptador === 'meta' && p.preco === 219.9 && p.nome === 'Whey 3W 1,8 kg & Coqueteleira' &&
    p.peso_g === 1800 && p.marca === "Marca 'Y'" && p.disponivel, p);
  p = gs.extrairDe_('html', fx('meta-oferta.html').replace('in stock', 'out of stock'), '');
  t('metatags: fora de estoque', p.disponivel === false, p);
  t('página sem preço → null', gs.extrairDe_('html', '<html><title>Whey</title></html>', '') === null);

  let pl = gs.planoDeColeta_('https://www.loja.com.br/iso-whey/p?skuId=62', '');
  t('plano: link VTEX vira API de catálogo, com o skuId', pl.length === 2 && pl[0].adaptador === 'vtex' &&
    pl[0].url === 'https://www.loja.com.br/api/catalog_system/pub/products/search/iso-whey/p' && pl[0].sku === '62' && pl[1].adaptador === 'html', pl);
  pl = gs.planoDeColeta_('https://Loja.com/products/kit-2x?variant=4001', '');
  t('plano: link Shopify vira /products/<handle>.js', pl[0].adaptador === 'shopify' && pl[0].url === 'https://loja.com/products/kit-2x.js' && pl[0].sku === '4001', pl);
  t('plano: outro link só tenta a página', gs.planoDeColeta_('https://www.gsuplementos.com.br/whey', '').map(x => x.adaptador).join() === 'html');
  t('plano: adaptador que funcionou antes vai primeiro', gs.planoDeColeta_('https://www.loja.com.br/x/p', 'jsonld')[0].adaptador === 'html');
  t('plano: link inválido', lanca(() => gs.planoDeColeta_('ftp://x', ''), /Link inválido/));

  const pesos = [['Whey 900g', 900], ['Refil 1,8 kg', 1800], ['Whey 2lb', null], ['Kit 3x 1kg', 3000], ['Dose de 30g, pote 900g', 900], ['KIT 2X DARK 900G', 1800]];
  t('peso a partir do título', pesos.every(([s, g]) => gs.pesoDoTitulo_(s) === g), pesos.map(([s]) => gs.pesoDoTitulo_(s)));
  t('números em formato brasileiro', gs.numero_('1.234,56') === 1234.56 && gs.numero_('R$ 199,90') === 199.9 && gs.numero_('83.22') === 83.22 && gs.numero_('') === null);
  t('frete da simulação VTEX: menor entrega, sem retirada', gs.freteDaSimulacao_(JSON.parse(fx('vtex-simulacao.json'))) === 19.9 && gs.freteDaSimulacao_({}) === null);
  t('intervalo do gatilho só aceita 1, 2, 4, 6, 8 ou 12 h', gs.intervaloValido_(7) === 6 && gs.intervaloValido_(24) === 12 && gs.intervaloValido_('') === 6 && gs.intervaloValido_('2') === 2);

  // A mesma regra de custo nos dois lados (o app calcula o ranking; o robô decide o alerta)
  const cots = [{ preco: 200 }, { preco: '199,90', frete: '10' }, { preco: 260 }, { preco: 300, desconto: 5 }, { preco: 0 },
    { preco: 200, disponivel: false }, { preco: 200, disponivel: 'FALSE' }, { preco: 249.99, frete: '' }];
  const lojas = [{}, { cupom_pct: 10, desconto_pix_pct: 5 }, { frete_fixo: 25, frete_gratis_acima: 250 }, { frete_fixo: '25', frete_gratis_acima: 0, desconto_pix_pct: '7,5' }];
  const dif = [];
  cots.forEach(c => lojas.forEach(l => {
    const a = JSON.stringify(ctx.custoEfetivo(c, l)), b = JSON.stringify(gs.custoEfetivo_(c, l));
    if (a !== b) dif.push({ c, l, app: a, gs: b });
  }));
  t('custoEfetivo do app e custoEfetivo_ do script dão o mesmo resultado', !dif.length, dif);
}

// ---------------------------------------------------------------- robô, gravação e API numa planilha em memória
{
  const URL_VTEX = 'https://www.loja-a.com.br/iso-whey/p';
  const SIM = 'https://www.loja-a.com.br/api/checkout/pub/orderForms/simulation';
  let precoChoc = 319.9, simCode = 200, bloqueada = true;
  const G = criarGas(url => {
    if (url === 'https://www.loja-a.com.br/api/catalog_system/pub/products/search/iso-whey/p') {
      const j = JSON.parse(fx('vtex-produto.json'));
      j[0].items[1].sellers[0].commertialOffer.Price = precoChoc;
      return { code: 200, body: j };
    }
    if (url === SIM) return { code: simCode, body: simCode === 200 ? fx('vtex-simulacao.json') : '<html>Acesso bloqueado</html>' };
    if (url === 'https://darklab.com.br/products/kit-2x.js') return { code: 200, body: fx('shopify-produto.json') };
    if (url.startsWith('https://www.bloqueada.com.br/')) return bloqueada ? { code: 403, body: 'bloqueado' } : { code: 200, body: fx('jsonld-oferta.html') };
  });
  const { gs, linhas } = G;
  const hoje = isoBrasilia(new Date()).slice(0, 10);
  const mon = id => linhas('Monitores').find(m => m.monitor_id === id);
  const cot = id => linhas('Cotacoes').find(c => c.cotacao_id === id);
  const up = (aba, id, dados) => ({ op: 'upsert', aba, id, dados });

  gs.setup();
  t('setup cria as 6 abas, a Config padrão, o TOKEN e o gatilho de 6 h', Object.keys(G.abas).length === 6 && linhas('Config').length === 8 &&
    /^[0-9a-f]{32}$/.test(G.props.TOKEN) && G.gatilhos.length === 1 && G.gatilhos[0].funcao === 'coletarTodos' && G.gatilhos[0].h === 6, G.gatilhos);
  const tok = G.props.TOKEN;
  gs.setup();
  t('setup é idempotente', linhas('Config').length === 8 && G.gatilhos.length === 1 && G.props.TOKEN === tok);
  const api = tenta(() => gs.testarApi());
  t('testarApi (upsert, mínimo, delete, fórmula, bootstrap)', !(api && api.erro), api);

  gs.aplicarOps_([
    up('Config', 'cep', { valor: '01001000' }), up('Config', 'log_max_linhas', { valor: 12 }),
    up('Lojas', 'LA', { nome: 'Loja A', desconto_pix_pct: 10 }), up('Lojas', 'LB', { nome: 'Bloqueada' }), up('Lojas', 'LC', { nome: 'Dark', frete_fixo: 30 }),
    up('Produtos', 'P1', { marca: 'Max', nome: 'IsoWhey', peso_g: 900, dose_g: 30, proteina_dose_g: 27, preco_alvo: 310 }),
    up('Produtos', 'P2', { marca: 'Y', nome: 'Outro', peso_g: 1000, dose_g: 30, proteina_dose_g: 24 }),
    up('Monitores', 'M1', { produto_id: 'P1', loja_id: 'LA', url: URL_VTEX, sku: '62', ativo: true }),
    up('Monitores', 'M2', { produto_id: 'P2', loja_id: 'LB', url: 'https://www.bloqueada.com.br/whey', ativo: true }),
    up('Monitores', 'M3', { produto_id: 'P2', loja_id: 'LC', url: 'https://darklab.com.br/products/kit-2x', sku: '4001', ativo: true }),
  ]);

  let r = gs.coletar_({}, 60000);
  t('coleta visita os 3 monitores ativos', r.coletados === 3 && r.restantes === 0, r);
  let c1 = cot('auto_M1_' + hoje);
  t('cotação automática do dia com preço do sabor e frete simulado para o CEP', c1 && c1.preco === 319.9 && c1.preco_min_dia === 319.9 && c1.frete === 19.9 &&
    c1.disponivel === true && c1.origem === 'auto' && c1.preco_lista === 359.9 && /T.*-03:00$/.test(c1.data), c1);
  let m1 = mon('M1');
  t('monitor atualizado: ok, adaptador, último preço', m1.ultimo_status === 'ok' && m1.adaptador === 'vtex' && m1.ultimo_preco === 319.9 && m1.falhas_seguidas === 0, m1);
  t('alerta por e-mail quando o custo efetivo fica abaixo do alvo (319,90 − 10 % + 19,90 = 307,81 ≤ 310)',
    G.emails.length === 1 && /IsoWhey/.test(G.emails[0].corpo) && /307,81/.test(G.emails[0].corpo) && G.emails[0].para === 'dono@exemplo.com' && m1.alerta_enviado === true, G.emails);
  const m2 = mon('M2');
  t('loja que bloqueia: erro com o HTTP e falha contada', m2.ultimo_status === 'erro' && m2.falhas_seguidas === 1 && /HTTP 403/.test(m2.ultimo_erro), m2);
  const c3 = cot('auto_M3_' + hoje);
  t('Shopify sem simulação: frete fica vazio (vale a regra da loja)', c3 && c3.preco === 377.56 && c3.frete === '' && mon('M3').adaptador === 'shopify', c3);
  t('cada coleta grava uma linha no ColetaLog', linhas('ColetaLog').length === 3 && linhas('ColetaLog').filter(l => l.resultado === 'erro').length === 1);

  precoChoc = 299.9; gs.coletar_({ monitor_id: 'M1' }, 60000);
  precoChoc = 349.9; gs.coletar_({ monitor_id: 'M1' }, 60000);
  c1 = cot('auto_M1_' + hoje);
  t('mesmo dia: uma linha só, com o último preço e o menor do dia', linhas('Cotacoes').filter(c => String(c.cotacao_id).startsWith('auto_M1_')).length === 1 &&
    c1.preco === 349.9 && c1.preco_min_dia === 299.9, c1);
  t('alerta não se repete enquanto segue abaixo e rearma quando sobe', G.emails.length === 1 && mon('M1').alerta_enviado === false);
  precoChoc = 299.9; gs.coletar_({ monitor_id: 'M1' }, 60000);
  t('nova queda, novo alerta', G.emails.length === 2);

  simCode = 403;
  gs.coletar_({ monitor_id: 'M1' }, 60000);
  const simAntes = G.fetches.filter(f => f.url === SIM).length;
  gs.coletar_({ monitor_id: 'M1' }, 60000);
  t('simulação de frete bloqueada: cai na regra da loja e não insiste por 6 h', cot('auto_M1_' + hoje).frete === '' &&
    G.fetches.filter(f => f.url === SIM).length === simAntes && G.cache['simbloq_https://www.loja-a.com.br'] === '1');

  for (let i = 0; i < 4; i++) gs.coletar_({}, 60000);
  const m2p = mon('M2');
  t('5 falhas seguidas pausam o monitor e avisam por e-mail', m2p.ativo === false && m2p.ultimo_status === 'pausado' && m2p.falhas_seguidas === 5 &&
    G.emails.some(e => /pausado/.test(e.corpo)), m2p);
  r = gs.coletar_({}, 60000);
  t('monitor pausado sai da rodada automática', r.coletados === 2 && !r.resultados.some(x => x.monitor_id === 'M2'), r);
  bloqueada = false;
  r = gs.coletar_({ monitor_id: 'M2' }, 60000);
  t('coletar agora num monitor pausado que voltou a funcionar o reativa', mon('M2').ativo === true && mon('M2').ultimo_status === 'ok' &&
    mon('M2').falhas_seguidas === 0 && mon('M2').adaptador === 'jsonld', mon('M2'));
  t('link cadastrado sem sabor trava o SKU lido na primeira coleta', mon('M2').sku === 'whey-concentrado-chocolate' && mon('M3').sku === '4001', mon('M2'));
  t('ColetaLog é podado ao limite da Config', linhas('ColetaLog').length === 12, linhas('ColetaLog').length);

  r = gs.coletar_({}, -1);
  t('orçamento de tempo esgotado: para e informa os restantes', r.coletados === 0 && r.restantes === 3, r);
  r = gs.coletar_({ antes: '2000-01-01' }, 60000);
  t('filtro "antes" pula os já coletados (coletar todos em várias chamadas)', r.coletados === 0 && r.restantes === 0, r);

  const prods = gs.indexar_(linhas('Produtos'), 'produto_id'), lojas = gs.indexar_(linhas('Lojas'), 'loja_id');
  const visita = gs.coletarMonitor_(mon('M3'), prods, lojas, gs.lerConfig_());
  gs.aplicarOps_([{ op: 'delete', aba: 'Monitores', id: 'M3' }]);
  gs.gravarColeta_(visita.ops, 100);
  t('monitor apagado durante a coleta não é recriado', !mon('M3'));

  gs.aplicarOps_([up('Cotacoes', 'OLD', { produto_id: 'P1', loja_id: 'LA', origem: 'manual', data: '2025-01-01T10:00:00-03:00', preco: 200, disponivel: true })]);
  const b = gs.bootstrap_();
  t('bootstrap: menor já visto sobre todo o histórico, cache só com os últimos dias e sem campos vazios',
    b.minimos.P1.custo === 180 && b.minimos.P1.data === '2025-01-01T10:00:00-03:00' && !b.cotacoes.some(c => c.cotacao_id === 'OLD') &&
    b.cotacoes.length > 0 && b.cotacoes.every(c => Object.values(c).every(v => v !== '')), b.minimos);

  const get = p => JSON.parse(gs.doGet({ parameter: p }).getContent());
  const post = corpo => JSON.parse(gs.doPost({ postData: { contents: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) } }).getContent());
  t('API: token inválido é recusado', get({ token: 'x', acao: 'ping' }).erro === 'Token inválido' && post({ token: 'x', ops: [] }).ok === false);
  t('API: ping', get({ token: tok, acao: 'ping' }).versao === '1.0.0');
  let e = get({ token: tok, acao: 'extrair', url: URL_VTEX + '?skuId=63' });
  t('API: extrair devolve a prévia com os sabores', e.ok && e.previa.sku === '63' && e.previa.skus.length === 3 && e.previa.adaptador === 'vtex' && e.previa.host === 'https://www.loja-a.com.br', e);
  bloqueada = true;
  e = get({ token: tok, acao: 'extrair', url: 'https://www.bloqueada.com.br/x' });
  t('API: extrair numa loja que bloqueia explica o motivo', e.ok === false && /Bloqueado pela loja \(HTTP 403\)/.test(e.erro), e);
  e = get({ token: tok, acao: 'coletar', monitor_id: 'M1' });
  t('API: coletar um monitor', e.ok && e.coletados === 1 && e.resultados[0].status === 'ok', e);
  e = post({ token: tok, ops: [up('Cotacoes', 'X', { obs: '=HYPERLINK("http://x")', preco: 10 })] });
  t('API: POST grava e fórmula vira texto', e.ok && e.aplicados === 1 && cot('X').obs === '=HYPERLINK("http://x")', cot('X'));
  t('API: op inválida e JSON inválido', post({ token: tok, ops: [{ op: 'drop', aba: 'Cotacoes', id: 'X' }] }).ok === false && /JSON inválido/.test(post('{').erro));

  gs.aplicarOps_([up('Config', 'intervalo_coleta_h', { valor: 4 })]);
  gs.coletarTodos();
  t('gatilho é reinstalado quando o intervalo muda na Config', G.gatilhos.length === 1 && G.gatilhos[0].h === 4 && G.props.INTERVALO === '4', G.gatilhos);
}

// ---------------------------------------------------------------- setup em situações reais de instalação
{
  const sem = criarGas({}, { semAbaAtiva: true });
  const r = tenta(() => sem.gs.setup());
  t('setup cria as abas mesmo sem aba ativa ("Planilha 0 não encontrada")', !(r && r.erro) && Object.keys(sem.abas).length === 6, r);
  const av = criarGas({}, { avulso: true });
  t('projeto avulso sem PLANILHA_ID: erro que explica o que fazer', lanca(() => av.gs.setup(), /Extensões > Apps Script.*PLANILHA_ID/));
  av.props.PLANILHA_ID = 'ID_DA_PLANILHA';
  const r2 = tenta(() => av.gs.setup());
  t('projeto avulso com PLANILHA_ID: setup funciona', !(r2 && r2.erro) && Object.keys(av.abas).length === 6, r2);

  const np = criarGas(() => ({ code: 200, body: fx('jsonld-oferta.html') }));
  np.gs.setup();
  np.gs.aplicarOps_([{ op: 'upsert', aba: 'Monitores', id: 'M1', dados: { produto_id: 'P', loja_id: 'L', url: 'https://x.com.br/whey', ativo: true } }]);
  const semPerm = criarGas({}, { semPermissao: true });
  t('permissão negada: setup e testarColeta pedem autorização em vez de seguir', lanca(() => semPerm.gs.setup(), /Autorização necessária/) &&
    lanca(() => semPerm.gs.testarColeta(), /Autorização necessária/));
  // Mesma planilha, agora sem permissão: a rodada do robô para antes de tocar nos links
  const ctxNp = np.ctx;
  ctxNp.ScriptApp.requireAllScopes = () => { throw new Error('Autorização necessária para executar este script'); };
  t('permissão negada: a coleta para sem contar falha nem pausar links', lanca(() => np.gs.coletar_({}, 60000), /Autorização necessária/) &&
    !np.linhas('Monitores')[0].falhas_seguidas && np.fetches.length === 0 && !np.linhas('ColetaLog').length);
}

let falhas = 0;
for (const r of res) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.nome}`);
  if (!r.ok) { falhas++; console.log('   ', JSON.stringify(r.info)); }
}
console.log(`\n${res.length - falhas}/${res.length} passaram`);
process.exit(falhas ? 1 : 0);
