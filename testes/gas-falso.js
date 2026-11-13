// Ambiente falso do Google Apps Script para rodar o Code.gs de verdade no Node:
// planilha em memória, UrlFetchApp com rotas fixas, e-mails e gatilhos registrados.
// Usado por testes/rodar.js (robô e gravação) e testes/e2e.js (Web App falso com a mesma semântica).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const CODE_GS = path.join(__dirname, '..', 'apps-script', 'Code.gs');

function criarAba(nome) {
  const rows = [];
  const sh = {
    rows,
    getName: () => nome,
    getLastRow: () => rows.length,
    getLastColumn: () => rows.reduce((m, r) => Math.max(m, r.length), 0),
    getMaxRows: () => Math.max(rows.length, 1000),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
        const v = (rows[r - 1 + i] || [])[c - 1 + j];
        return v === undefined ? '' : v;
      })),
      // Como no Sheets: o apóstrofo inicial marca texto e some; texto começando com = vira fórmula calculada
      setValues: vals => vals.forEach((linha, i) => {
        const rr = rows[r - 1 + i] || (rows[r - 1 + i] = []);
        linha.forEach((v, j) => {
          rr[c - 1 + j] = typeof v !== 'string' ? v : v.startsWith("'") ? v.slice(1) : v.startsWith('=') ? '#FÓRMULA CALCULADA' : v;
        });
      }),
      setNumberFormat: () => {},
      setFontWeight: () => {},
    }),
    getDataRange: () => sh.getRange(1, 1, Math.max(rows.length, 1), Math.max(sh.getLastColumn(), 1)),
    deleteRow: i => rows.splice(i - 1, 1),
    deleteRows: (i, n) => rows.splice(i - 1, n),
    setFrozenRows: () => {},
  };
  return sh;
}

/** ISO com o fuso de Brasília (sem horário de verão desde 2019), como o formatDate do script. */
const isoBrasilia = d => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 19) + '-03:00';

/**
 * rotas: { url: () => ({ code, body }) } ou função (url, opcoes) → { code, body } | undefined
 * opcoes: { avulso (projeto sem planilha vinculada), semAbaAtiva (insertSheet sem índice falha),
 *           semPermissao (alguma permissão negada no consentimento granular) }
 * → { ctx, gs (atalho para chamar funções do script), abas, emails, fetches, gatilhos, props, linhas(aba) }
 */
function criarGas(rotas = {}, opcoes = {}) {
  const abas = {};
  const emails = [], fetches = [], gatilhos = [], dormiu = [];
  const props = {}, cache = {};
  const planilha = {
    getSheetByName: n => abas[n] || null,
    // Como no Google: sem índice, a aba nova entra depois da aba ativa, que pode não existir para o script
    insertSheet: (n, indice) => {
      if (indice === undefined && opcoes.semAbaAtiva) throw new Error('Planilha 0 não encontrada');
      return (abas[n] = criarAba(n));
    },
    getSheets: () => Object.values(abas),
    deleteSheet: s => { delete abas[s.getName()]; },
    getName: () => 'Planilha falsa',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/falsa',
  };
  const responder = (url, op) => {
    fetches.push({ url, metodo: (op && op.method) || 'get' });
    const r = typeof rotas === 'function' ? rotas(url, op) : rotas[url] && rotas[url](op);
    const { code = 404, body = '' } = r || {};
    return { getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body) };
  };
  const gatilho = { timeBased: () => gatilho, everyHours: h => { gatilho.h = h; return gatilho; }, create: () => { gatilhos.push({ funcao: gatilho.funcao, h: gatilho.h }); return gatilho; } };
  const ctx = vm.createContext({
    console,
    SpreadsheetApp: { getActive: () => opcoes.avulso ? null : planilha, openById: id => { if (id !== 'ID_DA_PLANILHA') throw new Error('Planilha ' + id + ' não encontrada'); return planilha; } },
    Session: { getScriptTimeZone: () => 'America/Sao_Paulo', getEffectiveUser: () => ({ getEmail: () => 'dono@exemplo.com' }) },
    Utilities: { getUuid: () => crypto.randomUUID(), sleep: ms => dormiu.push(ms), formatDate: d => isoBrasilia(d) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
    MailApp: { sendEmail: (para, assunto, corpo) => emails.push({ para, assunto, corpo }) },
    UrlFetchApp: { fetch: responder },
    Logger: { log: () => {} },
    ScriptApp: {
      getProjectTriggers: () => gatilhos.map(g => ({ getHandlerFunction: () => g.funcao, g })),
      deleteTrigger: t => gatilhos.splice(gatilhos.indexOf(t.g), 1),
      newTrigger: funcao => { gatilho.funcao = funcao; return gatilho; },
      AuthMode: { FULL: 'FULL' },
      requireAllScopes: () => { if (opcoes.semPermissao) throw new Error('Autorização necessária para executar este script'); },
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) },
  });
  vm.runInContext(fs.readFileSync(CODE_GS, 'utf8'), ctx, { filename: 'Code.gs' });
  // Expõe as funções do script (inclusive as declaradas com const) por nome
  const gs = new Proxy({}, { get: (_, nome) => vm.runInContext(nome, ctx) });
  const linhas = aba => gs.lerAba_(aba);
  return { ctx, gs, abas, emails, fetches, gatilhos, props, cache, dormiu, linhas, isoBrasilia };
}

module.exports = { criarGas, isoBrasilia };
