// Teste ponta a ponta: o Code.gs de verdade numa planilha em memória (testes/gas-falso.js), servido como
// Web App falso, com lojas simuladas pelas páginas de testes/fixtures, + navegador headless em viewport de celular.
// Uso: npm i && npm run e2e   (NAVEGADOR=caminho/do/chrome.exe para trocar o navegador)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { criarGas, isoBrasilia } = require('./gas-falso');

const RAIZ = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'capturas');
fs.mkdirSync(SHOTS, { recursive: true });
const fx = n => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const DIA = 864e5;
const d = n => isoBrasilia(new Date(Date.now() - n * DIA));
const hoje = d(0).slice(0, 10);

// Lojas simuladas
let precoA = 326.18;
const vtex = (nome, marca, preco62) => {
  const j = JSON.parse(fx('vtex-produto.json'));
  Object.assign(j[0], { productName: nome, brand: marca });
  j[0].items[1].sellers[0].commertialOffer.Price = preco62;
  return j;
};
const G = criarGas(url => {
  if (url === 'https://www.loja-a.com.br/api/catalog_system/pub/products/search/isowhey/p') return { code: 200, body: vtex('IsoWhey 900g', 'Max', precoA) };
  if (url === 'https://www.loja-teste.com.br/api/catalog_system/pub/products/search/whey-x/p') return { code: 200, body: vtex('Whey Protein Concentrado X 900g', 'Marca Teste', 289.9) };
  if (url.startsWith('https://www.bloqueada.com.br/')) return { code: 403, body: 'Acesso bloqueado' };
});
const { gs, linhas } = G;
gs.setup();
const TOKEN = G.props.TOKEN;
const up = (aba, id, dados) => ({ op: 'upsert', aba, id, dados });
const ops = [
  up('Lojas', 'LA', { nome: 'Loja A', tipo: 'online', url: 'https://www.loja-a.com.br', plataforma: 'vtex', desconto_pix_pct: 10, ativo: true }),
  up('Lojas', 'LB', { nome: 'Loja B', tipo: 'online', url: 'https://www.loja-b.com.br', plataforma: 'outra', frete_fixo: 20, frete_gratis_acima: 300, ativo: true }),
  up('Lojas', 'LX', { nome: 'Bloqueada', tipo: 'online', url: 'https://www.bloqueada.com.br', plataforma: 'outra', ativo: true }),
  up('Produtos', 'P1', { marca: 'Max', nome: 'IsoWhey', tipo: 'isolado', sabor: 'Chocolate', peso_g: 900, dose_g: 30, proteina_dose_g: 27, preco_alvo: 300, ativo: true }),
  up('Produtos', 'P2', { marca: 'Prob', nome: 'Pure Whey', tipo: 'concentrado', peso_g: 900, dose_g: 30, proteina_dose_g: 21, ativo: true }),
  up('Produtos', 'P3', { marca: 'Velha', nome: 'Whey Velho', tipo: 'blend', peso_g: 1000, dose_g: 30, proteina_dose_g: 18, ativo: true }),
  up('Monitores', 'M1', { produto_id: 'P1', loja_id: 'LA', url: 'https://www.loja-a.com.br/isowhey/p', sku: '62', sku_nome: 'Chocolate', adaptador: 'vtex',
    ativo: true, ultima_coleta: d(0), ultimo_preco: 326.18, ultimo_status: 'ok', falhas_seguidas: 0 }),
  up('Monitores', 'M2', { produto_id: 'P2', loja_id: 'LX', url: 'https://www.bloqueada.com.br/pure', ativo: false, ultima_coleta: d(1),
    ultimo_status: 'pausado', ultimo_erro: 'Bloqueado pela loja (HTTP 403)', falhas_seguidas: 5 }),
  up('Cotacoes', 'C2B', { produto_id: 'P2', loja_id: 'LB', origem: 'manual', data: d(1), preco: 199.9, disponivel: true }),
  up('Cotacoes', 'C2A', { produto_id: 'P2', loja_id: 'LA', origem: 'manual', data: d(20), preco: 180, disponivel: true }),
  up('Cotacoes', 'C3B', { produto_id: 'P3', loja_id: 'LB', origem: 'manual', data: d(40), preco: 100, disponivel: true }),
  up('Produtos', 'P4', { categoria: 'creatina', marca: 'Max', nome: 'Creatina 300 g', tipo: 'monohidratada', peso_g: 300, dose_g: 3, proteina_dose_g: 3, ativo: true }),
  up('Cotacoes', 'C4A', { produto_id: 'P4', loja_id: 'LA', origem: 'manual', data: d(0), preco: 60, disponivel: true }),
];
[340, 338, 335, 345, 330, 329, 331, 327, 328, 326.18].forEach((p, i) => {
  const n = 9 - i, dia = d(n);
  ops.push(up('Cotacoes', `auto_M1_${dia.slice(0, 10)}`, { produto_id: 'P1', loja_id: 'LA', monitor_id: 'M1', origem: 'auto', data: dia,
    preco: p, preco_min_dia: n === 5 ? 310 : p, disponivel: true, registrado_em: dia }));
});
gs.aplicarOps_(ops);

let offline = false, posts = 0;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/' || u.pathname === '/index.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(fs.readFileSync(RAIZ + '/index.html')); }
  if (u.pathname !== '/exec') { res.statusCode = 404; return res.end(); }
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Content-Type', 'application/json');
  if (offline) { req.socket.destroy(); return; }
  if (req.method === 'OPTIONS') { res.statusCode = 405; return res.end('preflight não suportado'); }
  if (req.method === 'GET') return res.end(gs.doGet({ parameter: Object.fromEntries(u.searchParams) }).getContent());
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    if (!/^text\/plain/.test(req.headers['content-type'] || '')) return res.end(JSON.stringify({ ok: false, erro: 'content-type ' + req.headers['content-type'] }));
    posts++;
    res.end(gs.doPost({ postData: { contents: b } }).getContent());
  });
});

const ok = (c, m) => { if (!c) { console.log('✗ ' + m); process.exitCode = 1; } else console.log('✓ ' + m); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const um = (lista, f) => lista.find(f) || {};

(async () => {
  await new Promise(r => srv.listen(8766, r));
  const browser = await chromium.launch({ executablePath: process.env.NAVEGADOR || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_EMPTY_RESPONSE|Failed to fetch/.test(m.text())) erros.push(m.text()); }); // o offline simulado gera ERR_EMPTY_RESPONSE
  page.on('dialog', dl => dl.accept());
  const filaVazia = () => page.waitForFunction(() => JSON.parse(localStorage.getItem('whey.fila') || '[]').length === 0, null, { timeout: 15000 });
  const textos = sel => page.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  const B = 'http://localhost:8766/';

  // testes do núcleo no navegador
  await page.goto(B + '?test');
  const resumoTestes = await page.textContent('.card b');
  ok(/^(\d+)\/\1 passaram$/.test(resumoTestes) && !(await page.$('.testes li.f')), 'index.html?test no navegador: ' + resumoTestes);

  await page.goto(B);
  await page.screenshot({ path: SHOTS + '/01-inicio-vazio.png' });
  await page.goto(B + '#/config');
  await page.fill('#c-url', B + 'exec');
  await page.fill('#c-token', TOKEN);
  await page.click('[data-a=salvarCfg]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('whey.cache') || '{}').produtos?.length === 4);
  ok(true, 'bootstrap carregou produtos, lojas, monitores e cotações');

  // ranking (RP-16..RP-18, RP-21)
  await page.goto(B + '#/');
  await page.waitForSelector('.rk');
  let rk = await textos('.rk');
  ok(rk.length === 2 && /Pure Whey/.test(rk[0]) && /349,05/.test(rk[0]) && /Loja B/.test(rk[0]) && /IsoWhey/.test(rk[1]) && /362,42/.test(rk[1]),
    'ranking 7 dias por R$/kg de proteína: ' + rk.map(x => x.slice(0, 60)).join(' | '));
  ok(/R\$ 293,56/.test(rk[1]) && /abaixo do alvo/.test(rk[1]) && /IsoWhey/.test(await page.textContent('#alertas')), 'destaque abaixo do preço-alvo');
  ok(/1 link com erro ou pausado/.test(await page.textContent('#app')), 'aviso de monitor pausado no início');
  const lider = (await page.textContent('#lider')).replace(/\s+/g, ' ');
  ok(/Prob Pure Whey/.test(lider) && /349,05/.test(lider) && /4 % mais barato por kg de proteína que o 2º, Max IsoWhey/.test(lider) &&
    /Já houve oferta melhor: Velha Whey Velho chegou a R\$ 200,00\/kg há 40 dias/.test(lider), 'melhor compra agora: ' + lider);
  ok((await page.$$('#grafc polyline')).length >= 1 && (await page.$$('#comparativo .legc')).length === 2, 'gráfico comparativo com legenda por produto (Whey Velho: só cotação de 40 dias, fora dos 30)');
  const box = await page.$eval('#grafc', e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  await page.hover('#grafc', { position: { x: box.w - 5, y: box.h / 2 } });
  const dica = await page.$eval('#grafc-tip', e => e.classList.contains('on') ? e.textContent : '');
  ok(/IsoWhey/.test(dica) && /Pure Whey/.test(dica), 'dica do comparativo lista os produtos do dia: ' + dica.replace(/\n/g, ' / '));
  await page.mouse.move(5, 5);
  await page.locator('#comparativo').screenshot({ path: SHOTS + '/02b-comparativo.png' });
  ok(/histórico curto/.test(rk[1]), 'ranking marca o momento (histórico curto com 10 dias)');
  ok(!rk.some(x => /Creatina/.test(x)), 'aba Whey não mostra creatina');
  await page.click('[data-a=categoria][data-c=creatina]');
  const rkC = await textos('.rk');
  ok(rkC.length === 1 && /Max Creatina 300 g/.test(rkC[0]) && /180,00 \/kg creatina/.test(rkC[0]) && /100% creatina/.test(rkC[0]) &&
    /R\$ por kg de creatina/.test(await page.textContent('#comparativo')) && /\/kg de creatina/.test(await page.textContent('#lider')), 'aba Creatina: ranking em R$/kg de creatina: ' + rkC.join(' | ').slice(0, 120));
  await page.screenshot({ path: SHOTS + '/02c-creatina.png', fullPage: true });
  await page.goto(B + '#/produto/P4');
  ok(/Por kg de creatina\s*R\$ 180,00/.test(await page.textContent('#app')), 'produto de creatina fala em kg de creatina');
  await page.goto(B + '#/');
  await page.click('[data-a=categoria][data-c=whey]');
  await page.screenshot({ path: SHOTS + '/02-ranking.png', fullPage: true });
  await page.click('[data-a=janela][data-d="30"]');
  rk = await textos('.rk');
  ok(/Pure Whey/.test(rk[0]) && /257,14/.test(rk[0]) && /Loja A/.test(rk[0]), 'janela de 30 dias traz a oferta mais barata de 20 dias atrás');
  await page.click('[data-a=janela][data-d="0"]');
  ok((await page.$$('.rk')).length === 3, 'janela "Tudo" inclui a cotação de 40 dias');
  await page.selectOption('#f-tipo', 'isolado');
  ok((await page.$$('.rk')).length === 1 && /IsoWhey/.test(await page.textContent('.rk')), 'filtro por tipo');
  await page.selectOption('#f-tipo', '');
  await page.click('[data-a=janela][data-d="7"]');

  // histórico (RP-19, RP-20)
  await page.goto(B + '#/produto/P1');
  await page.waitForSelector('#graf polyline');
  const hist = await page.textContent('#app');
  ok(/Menor já visto\s*R\$ 279,00/.test(hist), 'menor já visto usa o menor preço do dia (310 − 10 %)');
  const mom = (await page.textContent('#momento')).replace(/\s+/g, ' ');
  ok(/Comprar agora\?/.test(mom) && /mais barato que em 95 % dos últimos 10 dias/.test(mom) && /Histórico curto \(10 dias\)/.test(mom) && /Bom preço até/.test(hist),
    'comprar agora ou esperar: ' + mom);
  ok((await page.$$('#graf circle')).length === 10, 'gráfico com um ponto por dia');
  await page.hover('#graf', { position: { x: 300, y: 80 } });
  ok(await page.$eval('#graf-tip', e => e.classList.contains('on') && /Loja A/.test(e.textContent)), 'dica do gráfico ao tocar/passar o dedo');
  await page.screenshot({ path: SHOTS + '/03-historico.png', fullPage: true });

  // monitorar link novo (RP-08, RP-09)
  await page.goto(B + '#/');
  await page.click('[data-a=modal][data-t=novo]');
  await page.click('.modal [data-a=novoMonitor]');
  await page.fill('#m-url', 'https://www.loja-teste.com.br/whey-x/p');
  await page.click('[data-a=extrair]');
  await page.waitForSelector('#m-sku');
  ok(await page.inputValue('#np-peso') === '900' && await page.inputValue('#np-nome') === 'Whey Protein Concentrado X 900g' && await page.inputValue('#np-marca') === 'Marca Teste',
    'prévia preenche nome, marca e peso pelo título');
  await page.selectOption('#m-sku', '62');
  ok(await page.inputValue('#np-sabor') === 'Chocolate' && /289,90/.test(await page.textContent('.valor')), 'trocar o sabor atualiza preço e sabor');
  await page.fill('#np-dose', '30');
  await page.fill('#np-prot', '24');
  ok(/80%/.test(await page.textContent('#np-pct')), '% de proteína calculada ao digitar');
  await page.fill('#m-loja-nome', 'Loja Teste');
  await page.screenshot({ path: SHOTS + '/04-novo-monitor.png', fullPage: true });
  await page.click('[data-a=salvarMonitor]');
  await page.waitForFunction(() => location.hash.startsWith('#/produto/'));
  await filaVazia();
  const pNovo = um(linhas('Produtos'), p => p.nome === 'Whey Protein Concentrado X 900g');
  const lNova = um(linhas('Lojas'), l => l.nome === 'Loja Teste');
  const mNovo = um(linhas('Monitores'), m => m.produto_id === pNovo.produto_id);
  ok(pNovo.peso_g === 900 && pNovo.dose_g === 30 && pNovo.proteina_dose_g === 24 && pNovo.sabor === 'Chocolate' && pNovo.marca === 'Marca Teste', 'produto criado na planilha: ' + JSON.stringify(pNovo));
  ok(lNova.plataforma === 'vtex' && lNova.url === 'https://www.loja-teste.com.br', 'loja criada a partir do link: ' + JSON.stringify(lNova));
  ok(mNovo.sku === '62' && mNovo.sku_nome === 'Chocolate' && mNovo.adaptador === 'vtex' && mNovo.loja_id === lNova.loja_id && mNovo.ultimo_status === 'ok', 'monitor gravado com o sabor escolhido');
  const cNova = um(linhas('Cotacoes'), c => c.cotacao_id === `auto_${mNovo.monitor_id}_${hoje}`);
  ok(cNova.preco === 289.9 && cNova.origem === 'auto' && /-03:00$/.test(cNova.data), 'a prévia virou a cotação automática de hoje (ID do dia)');

  // link de loja que bloqueia
  await page.goto(B + '#/monitores');
  await page.click('.bottom ~ * [data-a=novoMonitor], [data-a=novoMonitor]');
  await page.fill('#m-url', 'https://www.bloqueada.com.br/whey');
  await page.click('[data-a=extrair]');
  await page.waitForSelector('[data-a=nmManual]');
  ok(/Não consegui ler/.test(await page.textContent('#app')) && /HTTP 403/.test(await page.textContent('#app')), 'loja que bloqueia mostra o motivo e oferece cotação manual');

  // cotação manual sem rede (RP-15, RT-04)
  offline = true;
  await page.goto(B + '#/cotacao/P3');
  await page.selectOption('#c-loja', 'LA');
  await page.fill('#c-preco', '150,00');
  await page.fill('#c-obs', 'promoção no balcão');
  await page.click('[data-a=salvarCotacao]');
  await page.waitForFunction(() => location.hash === '#/produto/P3');
  await espera(1500);
  const badgeOff = await page.textContent('#badge');
  ok(/pendente|erro/.test(badgeOff), 'offline gera pendentes: ' + badgeOff);
  await page.goto(B + '#/');
  rk = await textos('.rk');
  ok(/Whey Velho/.test(rk[0]) && /225,00/.test(rk[0]) && /manual/.test(rk[0]), 'ranking usa a cotação manual na hora, mesmo sem rede');
  await page.screenshot({ path: SHOTS + '/05-offline.png', fullPage: true });
  offline = false;
  await page.evaluate(() => sincronizar());
  await filaVazia();
  const cMan = um(linhas('Cotacoes'), c => c.produto_id === 'P3' && c.loja_id === 'LA');
  ok(cMan.preco === 150 && cMan.origem === 'manual' && cMan.obs === 'promoção no balcão' && cMan.frete === '' && /T.*-03:00$/.test(cMan.data), 'cotação manual chegou à planilha: ' + JSON.stringify(cMan));

  // coletar agora (RP-13) e alerta por e-mail (RP-22)
  precoA = 299.9;
  await page.goto(B + '#/monitor/M1');
  await page.click('[data-a=coletarUm]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('whey.cache')).monitores.find(m => m.monitor_id === 'M1').ultimo_preco === 299.9, null, { timeout: 15000 });
  const c1 = um(linhas('Cotacoes'), c => c.cotacao_id === `auto_M1_${hoje}`);
  ok(c1.preco === 299.9 && c1.preco_min_dia === 299.9, 'coletar agora atualiza a cotação do dia');
  ok(G.emails.length === 1 && /IsoWhey/.test(G.emails[0].corpo) && /269,91/.test(G.emails[0].corpo), 'e-mail de alerta ao cruzar o preço-alvo');
  await page.screenshot({ path: SHOTS + '/06-monitor.png', fullPage: true });

  // robô: reativar o monitor pausado e coletar todos
  await page.goto(B + '#/monitores');
  await page.waitForSelector('[data-mid=M2]');
  ok(/pausado/.test(await page.textContent('[data-mid=M2]')) && /HTTP 403/.test(await page.textContent('[data-mid=M2]')), 'monitor pausado aparece com o erro');
  await page.screenshot({ path: SHOTS + '/07-robo.png', fullPage: true });
  await page.click('[data-mid=M2]');
  await page.check('#mo-ativo');
  await page.click('[data-a=salvarMonitorEd]');
  await filaVazia();
  const m2 = um(linhas('Monitores'), m => m.monitor_id === 'M2');
  ok(m2.ativo === true && m2.falhas_seguidas === 0 && m2.ultimo_status === '', 'reativar zera as falhas');
  await page.goto(B + '#/monitores');
  await page.click('[data-a=coletarTodos]');
  await page.waitForFunction(() => /Coleta concluída/.test(document.querySelector('#toast').textContent), null, { timeout: 20000 });
  ok(/3 links, 1 com erro/.test(await page.textContent('#toast')), 'coletar todos: ' + await page.textContent('#toast'));
  ok(um(linhas('Monitores'), m => m.monitor_id === 'M2').falhas_seguidas === 1, 'falha contada de novo após reativar');

  // lojas e config
  await page.goto(B + '#/loja/LB');
  await page.fill('#l-pix', '5');
  await page.click('[data-a=salvarLoja]');
  await page.goto(B + '#/config');
  await page.selectOption('#r-int', '4');
  await page.fill('#r-cep', '01001-000');
  await page.click('[data-a=salvarConfigApp]');
  await filaVazia();
  ok(um(linhas('Lojas'), l => l.loja_id === 'LB').desconto_pix_pct === 5, 'regra de desconto da loja gravada');
  const cfg = gs.lerConfig_();
  ok(Number(cfg.intervalo_coleta_h) === 4 && cfg.cep === '01001000', 'Config do robô gravada (intervalo e CEP)');
  await page.screenshot({ path: SHOTS + '/08-config.png', fullPage: true });

  // editor de produto: aviso de % de proteína suspeita (RP-02)
  await page.goto(B + '#/editar-produto/P3');
  await page.fill('#p-prot', '29');
  ok(/97%/.test(await page.textContent('#p-pct')) && /confira/.test(await page.textContent('#p-pct')), 'aviso de % de proteína fora de 50–95 %');
  await page.screenshot({ path: SHOTS + '/09-produto.png', fullPage: true });
  // editor: trocar a categoria troca tipos e rótulos
  await page.goto(B + '#/editar-produto/novo');
  await page.selectOption('#p-cat', 'creatina');
  ok(await page.textContent('#p-l-prot') === 'Creatina/dose (g)' && (await page.$$eval('#p-tipo option', os => os.map(o => o.textContent))).join() === 'Monohidratada,Creapure,Outra forma',
    'editor: categoria creatina troca tipos e rótulos');
  await page.fill('#p-dose', '3'); await page.fill('#p-prot', '3');
  ok(/100%/.test(await page.textContent('#p-pct')) && !/confira/.test(await page.textContent('#p-pct')), 'creatina pura: 100 % sem aviso');

  // proteína do laudo: grava na planilha e entra no ranking
  await page.goto(B + '#/editar-produto/P1');
  await page.fill('#p-laudo', '24');
  ok(/80%/.test(await page.textContent('#p-pct')), '% de proteína real usa o laudo ao digitar');
  await page.fill('#p-laudo-fonte', 'Lab X');
  await page.click('[data-a=salvarProduto]');
  await filaVazia();
  const p1 = um(linhas('Produtos'), p => p.produto_id === 'P1');
  ok(p1.proteina_laudo_g === 24 && p1.laudo_fonte === 'Lab X', 'laudo gravado na planilha');
  await page.goto(B + '#/');
  rk = await textos('.rk');
  const rIso = rk.find(x => /IsoWhey/.test(x)) || '';
  ok(/80% proteína \(laudo\)/.test(rIso) && /proteína laudo/.test(rIso), 'ranking usa a proteína do laudo: ' + rIso.slice(0, 110));
  // evitar lactose
  await page.goto(B + '#/config');
  await page.selectOption('#r-lact', 'sim');
  await page.click('[data-a=salvarConfigApp]');
  await filaVazia();
  await page.goto(B + '#/');
  ok((await page.$$('.rk')).length === 1 && /IsoWhey/.test(await page.textContent('.rk')) && gs.lerConfig_().evitar_lactose === 'sim', 'evitar lactose deixa só o isolado');
  await page.goto(B + '#/config');
  await page.selectOption('#r-lact', 'nao');
  await page.click('[data-a=salvarConfigApp]');

  // produtos agrupados por marca, fechados por padrão
  await page.goto(B + '#/produtos');
  const grupos = await page.$$('[data-grupo]');
  ok(grupos.length === 5 && (await page.$$('.grupo-corpo[hidden]')).length === 5 && !(await page.isVisible('text=IsoWhey')) &&
    (await textos('h2[data-cat]')).join() === 'Whey,Creatina', 'marcas fechadas por padrão, separadas por categoria');
  await page.screenshot({ path: SHOTS + '/10-produtos.png', fullPage: true });
  await page.click('[data-a=toggleMarca][data-m="whey|Max"]');
  ok(await page.isVisible('text=IsoWhey') && (await page.$$('.grupo-corpo[hidden]')).length === 4, 'tocar na marca abre a lista');
  await page.screenshot({ path: SHOTS + '/10b-produtos-aberto.png', fullPage: true });
  await page.click('[data-a=toggleMarca][data-m="whey|Max"]');
  ok(!(await page.isVisible('text=IsoWhey')), 'tocar de novo fecha');
  await page.fill('#busca', 'pure');
  ok(await page.isVisible('text=Pure Whey') && (await page.$$eval('[data-grupo]', gs => gs.filter(g => g.style.display !== 'none').length)) === 1, 'busca abre só a marca com resultado');
  await page.fill('#busca', '');
  ok((await page.$$('.grupo-corpo[hidden]')).length === 5, 'limpar a busca volta a fechar');
  await page.goto(B + '#/lojas');
  await page.screenshot({ path: SHOTS + '/11-lojas.png', fullPage: true });

  ok(erros.length === 0, 'sem erros no console ' + JSON.stringify(erros));
  console.log('POSTs:', posts, '· requisições às lojas:', G.fetches.length);
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
