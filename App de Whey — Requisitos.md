# App de Whey — Requisitos

Oct 30, 2026 · @Ciro Gonçalves de Andrade

## Visão geral

App pessoal, usado no celular, para acompanhar preços de whey protein e descobrir qual compra rende mais. Um robô no Google Apps Script revisita os links de oferta cadastrados, lê o preço e grava uma cotação por dia numa planilha Google. O app mostra o ranking por custo efetivo do kg de proteína, o histórico de preço de cada produto e avisa quando algo fica abaixo do preço-alvo. Roda a partir de um único arquivo HTML, com a mesma arquitetura do App de Treino.

**Princípios de projeto**

- A coleta de preços é automática. Digitar uma cotação é exceção, para lojas físicas ou lojas que bloqueiam robôs.
- A comparação é sempre pelo que se paga de fato (preço + frete − desconto) pela proteína que vem na embalagem.
- Cadastrar uma oferta nova leva poucos toques: colar o link e confirmar o produto.
- A planilha é a fonte da verdade e pode ser analisada fora do app.
- Uso individual: um usuário, uma planilha. Coleta em baixa frequência, só das páginas cadastradas.

**Termos usados neste documento**

| Termo | Significado |
| --- | --- |
| Produto | Um whey específico numa embalagem específica (ex.: Growth 100% Whey Concentrado, chocolate, 1 kg) |
| Loja | Onde se compra (ex.: site da Max Titanium, Growth, loja física do bairro) |
| Monitor | Um link de oferta de um produto numa loja, que o robô revisita |
| Coleta | Uma visita do robô a um monitor, com sucesso ou falha |
| Cotação | Um preço observado de um produto numa loja num dia, automático ou manual |
| Custo efetivo | Preço + frete − desconto, em R$ |
| Custo por kg de proteína | Custo efetivo ÷ (peso da embalagem em kg × % de proteína) |
| Adaptador | Forma de ler o preço de uma página: VTEX, Shopify, JSON-LD, metatags |
| Preço-alvo | Custo efetivo abaixo do qual o produto merece destaque e alerta |

## Requisitos de produto

### Catálogo de produtos

- **RP-01** Cadastrar produtos com marca, nome, tipo (concentrado, isolado, hidrolisado, blend), sabor, peso da embalagem (g), tamanho da dose (g) e proteína por dose (g).
- **RP-02** Calcular a % de proteína (proteína por dose ÷ dose) e avisar quando ficar fora de 50–95 %, que costuma indicar erro de digitação.
- **RP-03** Kits (ex.: 2 × 900 g) são um produto com o peso total.
- **RP-04** Definir um preço-alvo opcional por produto, em R$ de custo efetivo. O app mostra também o equivalente em R$/kg de proteína.
- **RP-05** Arquivar produtos. Arquivar não apaga cotações nem monitores; os monitores param de ser coletados.

### Lojas

- **RP-06** Cadastrar lojas com nome, tipo (online ou física), link e plataforma (VTEX, Shopify, outra), detectada pelo robô no primeiro link colado.
- **RP-07** Regras de custo por loja: frete fixo, frete grátis acima de um valor, desconto à vista/PIX (%) e cupom de texto livre com desconto (%). Elas entram no custo efetivo das cotações automáticas.

### Monitoramento automático

- **RP-08** Colar o link de uma oferta. O robô identifica a loja e a plataforma, e devolve nome, preço, preço de lista, disponibilidade, sabores (SKUs) e um peso sugerido a partir do título (ex.: 900g, 1,8 kg).
- **RP-09** Escolher o sabor (SKU) que será acompanhado e confirmar o vínculo do link com um produto existente, ou criar o produto ali mesmo com os campos sugeridos já preenchidos. Peso, dose e proteína por dose são sempre conferidos pelo usuário, pois a tabela nutricional costuma ser uma imagem.
- **RP-10** O robô revisita todos os monitores ativos num intervalo configurável (padrão: a cada 6 horas).
- **RP-11** Cada coleta bem-sucedida atualiza a cotação automática do dia daquele monitor: uma linha por monitor por dia, com o último preço e o menor preço do dia.
- **RP-12** Registrar a disponibilidade. Produto esgotado vira cotação com *indisponível*, sem preço, e sai do ranking.
- **RP-13** Botão *Coletar agora*, para um monitor ou para todos.
- **RP-14** Mostrar o estado de cada monitor: última coleta, último preço, ok, indisponível ou erro, e falhas seguidas. Após 5 falhas seguidas o monitor é pausado e aparece em destaque para revisão.

### Registro manual (exceção)

- **RP-15** Registrar uma cotação manual em poucos toques (produto, loja, preço; frete, desconto, link e observação opcionais), para loja física e lojas que bloqueiam o robô.

### Ranking de custo-benefício

- **RP-16** Ordenar os produtos pelo custo por kg de proteína, usando a cotação mais recente de cada par produto–loja dentro da janela de recência (padrão: 7 dias).
- **RP-17** Filtros: tipo, marca, loja, só disponíveis e janela de recência (hoje, 7 dias, 30 dias, tudo).
- **RP-18** Cada linha mostra custo efetivo, R$/kg de proteína, R$ por dose, loja, idade da cotação, origem (auto ou manual) e o selo *abaixo do alvo*. Tocar abre o histórico; um botão abre a oferta na loja.

### Histórico de preço

- **RP-19** Por produto: gráfico simples do custo efetivo por dia e por loja, menor preço já visto (com data e loja), mediana dos últimos 90 dias e lista das cotações.
- **RP-20** Indicar se o preço atual é bom: abaixo, perto (até 5 % acima) ou acima da mediana de 90 dias.

### Alertas

- **RP-21** Destacar no ranking e na tela inicial os produtos com cotação abaixo do preço-alvo.
- **RP-22** Avisar por e-mail, a partir do Apps Script, quando uma coleta automática fica abaixo do preço-alvo. O aviso sai uma vez por queda, não a cada coleta.
- **RP-23** Avisar quando um monitor é pausado por falhas seguidas.

## Requisitos técnicos

Um HTML estático conversa com um Google Apps Script publicado como Web App. O mesmo script roda o robô por gatilho de tempo. Nada a instalar: tudo roda na conta Google, de graça.

### Front-end

- **RT-01** Um único arquivo .html com HTML, CSS e JavaScript embutidos. Sem etapa de build e sem framework; bibliotecas externas só por CDN e apenas se indispensáveis. O gráfico do histórico é SVG gerado à mão.
- **RT-02** Funciona nas versões recentes de Chrome (Android) e Safari (iOS). Layout mobile-first, tema escuro, alvos de toque com pelo menos 48 px.
- **RT-03** Cálculos de custo, ranking, histórico e alertas são funções puras no bloco `<núcleo>`, testadas no Node e em `index.html?test`.

### Offline e sincronização

- **RT-04** Offline-first: toda ação do usuário grava primeiro no localStorage numa fila de envio, e a fila sincroniza quando houver rede, com backoff exponencial.
- **RT-05** Indicador sempre visível do estado: sincronizado, N pendentes ou erro.
- **RT-06** Cada registro criado no app recebe um UUID gerado no aparelho. A API faz upsert e delete por ID, então reenviar é sempre seguro.
- **RT-07** O cache local guarda produtos, lojas, monitores e as cotações dos últimos 180 dias, para ranking e histórico funcionarem sem rede. O bootstrap só substitui o cache quando a fila está vazia.
- **RT-08** Colar um link e coletar agora exigem rede. Sem rede, o monitor é salvo na fila e o robô faz a primeira coleta na próxima rodada.

### Back-end e API

- **RT-09** Google Apps Script vinculado à planilha, publicado como Web App (executar como: o dono; acesso: qualquer pessoa com o link).
- **RT-10** `GET ?token=…&acao=ping|bootstrap` para leitura; `GET ?token=…&acao=extrair&url=…` para pré-visualizar um link (RP-08); `GET ?token=…&acao=coletar[&monitor_id=…]` para coletar agora (RP-13).
- **RT-11** Gravação em lote por `POST` com Content-Type text/plain, para evitar o preflight de CORS, que o Apps Script não atende. Corpo `{ token, ops: [{ op: 'upsert'|'delete', aba, id, dados }] }`. Resposta sempre `{ ok: true, … }` ou `{ ok: false, erro }`.
- **RT-12** Toda chamada leva um token secreto, comparado com o valor guardado nas Script Properties, fora da planilha.
- **RT-13** Gravações do app e do robô usam o mesmo LockService, para não corromper linhas.
- **RT-14** Valores que começam com `= + - @` são gravados como texto. Colunas de data e de `_id` usam formato texto. Datas em ISO 8601 com fuso (`-03:00`).

### Coleta automática

- **RT-15** O robô usa `UrlFetchApp`, com `muteHttpExceptions`, timeout e um User-Agent de navegador comum. Entre duas requisições à mesma loja há uma pausa de pelo menos 2 s.
- **RT-16** Adaptadores tentados em ordem, do mais estável ao mais frágil:
  1. **VTEX:** API pública de catálogo da loja (`/api/catalog_system/pub/products/search`), em JSON, sem chave.
  2. **Shopify:** `/products/<handle>.js`, em JSON, sem chave.
  3. **JSON-LD** `schema.org/Product` com `Offer`/`AggregateOffer` embutido na página.
  4. **Metatags** `product:price:amount`, `og:price:amount` e `itemprop="price"`.
- **RT-17** As funções de extração são puras (recebem texto, devolvem `{ nome, preco, preco_lista, disponivel, skus }`) e são testadas no Node com páginas de exemplo em `testes/fixtures/`.
- **RT-18** Frete automático: nas lojas VTEX, pela simulação de carrinho pública (`/api/checkout/pub/orderForms/simulation`) com o CEP da aba Config. Nas demais, pela regra de frete da loja (RP-07).
- **RT-19** Gatilho de tempo criado por `instalarGatilho()` (e por `setup()`), com intervalo na aba Config. Cada execução para por conta própria antes de 5 minutos e continua de onde parou na rodada seguinte, por causa do limite de 6 minutos por execução.
- **RT-20** Orçamento de cotas (conta Gmail gratuita: 20.000 chamadas UrlFetch por dia, 90 min de gatilhos por dia, 100 e-mails por dia). Com 60 monitores a cada 6 horas são cerca de 480 chamadas e 15 minutos por dia, bem abaixo dos limites.
- **RT-21** Cada coleta grava uma linha na aba ColetaLog (data, monitor, adaptador, HTTP, resultado, erro). A aba é podada para as últimas 2.000 linhas.

### Hospedagem do HTML

- **RT-22** Publicar o arquivo num endereço estático https, como GitHub Pages. Isso permite adicionar à tela inicial do celular. Abrir o arquivo direto do aparelho (file://) serve só para testes.
- **RT-23** Limite assumido de um arquivo só: sem service worker, o app precisa de rede para abrir. Uma vez aberto, ranking, histórico e registro manual funcionam offline.

## Forma de coleta

A coleta é automática, por decisão do usuário. O navegador não consegue ler páginas de lojas por causa do CORS, então o robô roda no Apps Script. As três opções avaliadas foram estas:

| Opção | Prós | Contras |
| --- | --- | --- |
| 1. Manual | Simples e robusta; funciona em qualquer loja, inclusive física | Dá trabalho e o histórico fica com buracos; ninguém digita preço todo dia |
| 2. Híbrida (colar o link, o script extrai) | Cadastro rápido; falha de extração cai no preenchimento manual | Cada preço novo ainda depende de o usuário abrir a loja |
| 3. Automática (gatilho revisita os links) | Histórico diário sem esforço; alerta chega sozinho | Depende do HTML ou da API de cada loja; lojas com anti-robô ficam de fora; exige cuidado com cotas e termos de uso |

A v1 adota a opção 3 e aproveita a 2 como forma de cadastrar o monitor (RP-08). A opção 1 fica como exceção (RP-15).

### Viabilidade por fonte

Testado em 30/10/2026, a partir de uma conexão residencial. Os IPs do Google tendem a ser mais bloqueados que os residenciais, então o resultado real no Apps Script será confirmado na instalação.

| Fonte | Exemplos | Resultado | Viabilidade |
| --- | --- | --- | --- |
| Lojas VTEX | Max Titanium, Probiótica, Black Skull, Vitafor | API pública de catálogo devolve JSON com preço, preço de lista e estoque por SKU | Alta: API oficial da plataforma, estável |
| Simulação de frete VTEX | Max Titanium, Probiótica | HTTP 403 (bloqueio Cloudflare) na API pública de carrinho | Baixa: implementada com queda para a regra da loja |
| Lojas Shopify | Dark Lab | `products.json` devolve preço e disponibilidade por variante | Alta |
| JSON-LD na página | Growth | `schema.org/Offer` com preço em BRL | Média: muda se a loja trocar o tema |
| Varejistas com anti-robô | Netshoes, Centauro, Drogasil | HTTP 403 já na primeira requisição | Nenhuma: só manual |
| Mercado Livre (página) | — | Redireciona para verificação de conta | Nenhuma |
| Mercado Livre (API oficial) | — | Exige app no DevCenter e token OAuth em toda chamada; busca e itens devolvem 403 de política mesmo com token, segundo relatos de 2026 | Baixa e instável |
| Amazon (página) | — | HTTP 503 (bloqueio de robô) | Nenhuma |
| Amazon (API oficial) | — | A PA-API 5 foi desativada em maio de 2026. A sucessora (Creators API) exige ser afiliado com 10 vendas qualificadas nos últimos 30 dias | Inviável para uso pessoal |

### Termos de uso

Muitas lojas proíbem coleta automatizada nos termos de uso. O app reduz o impacto: lê só as páginas cadastradas, poucas vezes por dia, com pausa entre requisições, sem contornar bloqueios (sem trocar IP, resolver captcha ou fingir login). Quando uma loja bloqueia, o monitor é pausado e a cotação dessa loja passa a ser manual.

## Decisões sobre os pontos em aberto

| Ponto em aberto | Decisão | Motivo |
| --- | --- | --- |
| Forma de coleta | Automática por gatilho, com cadastro do monitor por link colado; manual só como exceção | Decisão do usuário |
| Mercado Livre e Amazon | Cotação manual na v1 | Páginas bloqueiam robôs e as APIs oficiais estão fechadas para uso pessoal (veja Viabilidade por fonte) |
| Sabores (SKUs) de um mesmo link | O monitor acompanha o sabor escolhido no cadastro; se ele acabar, a cotação fica *indisponível* | O produto do catálogo tem sabor, e o preço e o estoque variam por sabor |
| Frete das automáticas | Simulação real para o CEP da Config nas lojas VTEX; regra da loja nas demais e quando a simulação falha | É a única plataforma com simulação pública; a regra cobre o resto |
| Alerta fora do app | E-mail para o dono da planilha logo após a coleta que detectou a queda, um por queda; o alerta rearma quando o preço volta a subir acima do alvo | Chega sem abrir o app e não vira spam |
| Granularidade da cotação automática | Uma linha por monitor por dia, com ID determinístico (`auto_<monitor>_<AAAA-MM-DD>`) e upsert | A aba cresce de forma previsível (60 monitores ≈ 22 mil linhas/ano) e recoletar no mesmo dia é idempotente |
| Preço do dia | `preco` = último observado (usado no ranking); `preco_min_dia` = menor do dia (usado no menor preço já visto) | Uma promoção relâmpago entra no histórico sem distorcer o preço atual |
| Intervalo da coleta | 6 horas, ajustável em Config (1, 2, 4, 6, 8 ou 12) | São os intervalos que o gatilho do Apps Script aceita |
| Preço-alvo | Em R$ de custo efetivo por embalagem | É como se pensa num preço; o R$/kg de proteína equivalente aparece ao lado |
| Desconto nas automáticas | Regras da loja (PIX %, cupom %) aplicadas sobre o preço coletado | O robô não enxerga cupom nem desconto no checkout |
| Ranking | Cotação mais recente por par produto–loja dentro da janela; o produto aparece na melhor loja, com as demais ao abrir | Evita que preço velho ganhe do atual |
| Fórmula | Custo por kg de proteína = custo efetivo ÷ (peso_g ÷ 1000 × proteína_dose_g ÷ dose_g). R$ por dose = custo efetivo ÷ (peso_g ÷ dose_g) | Definição do pedido original |

## Modelo de dados na planilha

Seis abas, uma tabela por aba, com a chave na primeira coluna. Cotacoes é a aba que cresce; ColetaLog é podada.

| Aba | Uma linha por | Colunas |
| --- | --- | --- |
| Produtos | Produto do catálogo | produto\_id, marca, nome, tipo, sabor, peso\_g, dose\_g, proteina\_dose\_g, preco\_alvo, ativo, obs |
| Lojas | Loja | loja\_id, nome, tipo (online ou fisica), url, plataforma, frete\_fixo, frete\_gratis\_acima, desconto\_pix\_pct, cupom, cupom\_pct, ativo |
| Monitores | Link de oferta revisitado pelo robô | monitor\_id, produto\_id, loja\_id, url, sku, sku\_nome, adaptador, ativo, ultima\_coleta, ultimo\_preco, ultimo\_status, ultimo\_erro, falhas\_seguidas, alerta\_enviado |
| Cotacoes | Preço observado de um produto numa loja num dia | cotacao\_id, produto\_id, loja\_id, monitor\_id, origem (auto ou manual), data, preco, preco\_min\_dia, preco\_lista, frete, desconto, disponivel, url, obs, registrado\_em |
| ColetaLog | Visita do robô a um monitor | log\_id, data, monitor\_id, adaptador, http, resultado, preco, erro |
| Config | Parâmetro do app | chave, valor (ex.: intervalo\_coleta\_h = 6, janela\_dias = 7, cep = 01001000, email\_alertas = sim, falhas\_para\_pausar = 5) |

Datas em ISO 8601 com fuso. O token de acesso fica nas Script Properties, nunca na aba Config. Custo efetivo e R$/kg de proteína não são gravados: são calculados no app, para que corrigir o peso de um produto corrija todo o histórico.

## Fora do escopo da v1

Ficam para depois, para manter a primeira versão pequena e utilizável já na próxima compra:

- Descobrir produtos novos sozinho (ex.: buscar "whey" no catálogo das lojas VTEX). Na v1, o robô só revisita links cadastrados.
- Mercado Livre e Amazon automáticos (veja Viabilidade por fonte). Cotações dessas lojas são manuais.
- Ler a tabela nutricional da página. Peso, dose e proteína por dose são digitados.
- Contornar bloqueios anti-robô (proxies, captcha, navegador headless na nuvem).
- Vários usuários ou compartilhamento.
- Notificação push no celular; o alerta fora do app é por e-mail.
- Abrir o app sem rede (exigiria service worker, ou seja, um segundo arquivo).
