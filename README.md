# App de Whey

App pessoal para comparar preços de whey protein no celular. É um único `index.html` que grava numa planilha Google por meio de um Apps Script. O mesmo script tem um robô que revisita os links de oferta e grava o preço sozinho. Os requisitos estão em [App de Whey — Requisitos.md](App%20de%20Whey%20—%20Requisitos.md).

```
index.html            o app inteiro (HTML + CSS + JS, sem build)
apps-script/Code.gs   back-end e robô de coleta: colar no editor do Apps Script da planilha
testes/rodar.js       testes do núcleo do app e do Code.gs numa planilha em memória (Node, sem dependências)
testes/e2e.js         uso completo num navegador headless contra o Code.gs servido como Web App falso
testes/gas-falso.js   ambiente falso do Apps Script (planilha, UrlFetchApp, e-mail, gatilhos)
testes/fixtures/      páginas e respostas de exemplo de lojas VTEX, Shopify, JSON-LD e metatags
```

## Instalação (uma vez, ~10 min)

1. **Planilha.** Crie uma planilha Google vazia e abra *Extensões › Apps Script*.
2. **Script.** Apague o conteúdo de `Código.gs` e cole o de [apps-script/Code.gs](apps-script/Code.gs). Salve.
   - Se o projeto foi criado em script.google.com, e não pela planilha, crie em *Configurações do projeto › Propriedades do script* a propriedade `PLANILHA_ID` com o ID do link da planilha (o trecho entre `/d/` e `/edit`).
3. **Setup.** Escolha a função `setup` e clique em *Executar*. Autorize o acesso à planilha, a serviços externos (para ler as lojas) e ao envio de e-mail (para os alertas).
   - Ela cria as 6 abas, os cabeçalhos e os valores padrão da aba `Config`.
   - Ela gera o **TOKEN** nas Script Properties. Copie-o em *Execuções › Log*.
   - Ela instala o gatilho do robô (`coletarTodos`, a cada 6 horas).
   - Opcional: rode `seedExemplo` para ter três produtos e lojas reais de exemplo. Os valores nutricionais são ilustrativos: confira no rótulo.
   - Opcional: rode `testarColeta` para ver no log o que o robô consegue ler **a partir dos servidores do Google**. Nada é gravado.
   - Opcional: rode `testarApi` para um teste de fumaça da gravação.
4. **Publicar.** Vá em *Implantar › Nova implantação › App da Web*, com *Executar como: Eu* e *Quem pode acessar: Qualquer pessoa*. Copie a URL que termina em `/exec`.
5. **Hospedar o HTML (GitHub Pages).** Suba o `index.html` num repositório e ative *Settings › Pages* (branch `main`, pasta raiz). O app fica em `https://<usuario>.github.io/<repo>/`.
6. **Celular.** Abra o endereço e vá em *Config*. Cole a URL e o token, toque em *Testar* e depois em *Salvar*. Informe o CEP em *Robô e ranking* se quiser tentar o frete real nas lojas VTEX. Adicione à tela inicial (*Compartilhar › Adicionar à Tela de Início* no iPhone; *⋮ › Adicionar à tela inicial* no Android).

> **Ao alterar o `Code.gs`:** use *Implantar › Gerenciar implantações › Editar › Nova versão*. Assim a URL continua a mesma. O gatilho não precisa ser reinstalado.
> **Para trocar o token:** rode `trocarToken` e informe o novo token no app.
> **Para mudar o intervalo do robô:** mude em *Config* no app. Na rodada seguinte, o próprio robô reinstala o gatilho.

## Uso

- **Ranking (início):** produtos ordenados pelo custo efetivo do kg de proteína real, com a melhor loja de cada um. Filtros de tipo, marca, loja, janela (24 h, 7 dias, 30 dias, tudo) e esgotados. ↗ abre a oferta na loja. Os produtos abaixo do preço-alvo aparecem no topo e com a borda verde.
  - **Melhor compra agora:** o 1º do ranking, quanto ele é mais barato que o 2º, se o preço dele está bom hoje e se algum produto já esteve bem mais barato nos últimos 90 dias.
  - **Comparativo:** gráfico de linhas com o R$/kg de proteína de cada produto no melhor preço de cada dia (30, 90 ou 180 dias). Os 5 melhores de hoje ficam coloridos e os demais em cinza. Mais baixo é melhor.
  - **Momento de compra** (etiqueta em cada produto): *bom momento* quando o preço de hoje está entre os 25 % dias mais baratos dos últimos 90; *caro agora* quando está entre os 35 % mais caros e mais de 3 % acima da mediana; senão *preço normal*. Com menos de 14 dias de coleta aparece *histórico curto*.
- **Proteína real:** o R$/kg usa a proteína do rótulo. Se um laudo de laboratório mediu outro valor, informe-o no produto em *Proteína/dose no laudo*, com a fonte: o app passa a usar o valor medido e mostra o selo *laudo*. Isolado e concentrado não ganham peso extra: por grama de proteína, os estudos não mostram diferença de ganho muscular. O isolado vale a pena quando entrega proteína mais barata por kg, e o R$/kg já mede isso.
- **Evitar lactose (Config):** deixa só isolados e hidrolisados no ranking e no comparativo.
- **Produtos:** agrupados por marca e fechados; toque na marca para abrir. A busca abre só as marcas com resultado.
- **Monitorar um link (＋):** cole o link da oferta e toque em *Ler oferta*. O robô traz nome, marca, preço, sabores e o peso tirado do título. Escolha o sabor, vincule a um produto (ou crie um com os campos já preenchidos, conferindo dose e proteína no rótulo) e salve. A leitura já vira a cotação de hoje.
- **Cotação manual (＋):** para loja física, Mercado Livre, Amazon ou outra loja que bloqueia o robô. Frete e desconto em branco usam as regras da loja.
- **Histórico (toque num produto):** melhor preço agora, R$/kg de proteína e por dose, menor preço já visto, "bom preço até" (o nível dos 25 % dias mais baratos), o cartão *Comprar agora?* com a explicação e a posição no ranking, gráfico por loja e lista de cotações. No histórico diário, a última cotação de uma loja vale por até 7 dias.
- **Robô:** estado de cada link (ok, esgotado, erro ou pausado), último preço e último erro. *Coletar agora* num link ou em todos. Um link com 5 falhas seguidas é pausado e você recebe um e-mail. Para reativar, abra o link e marque *Ativo*.
- **Lojas:** regras de custo por loja: desconto PIX/à vista, cupom, frete fixo e frete grátis acima de um valor.
- **Alertas por e-mail:** quando o robô vê um custo efetivo abaixo do preço-alvo, manda um e-mail para a conta dona da planilha. Ele não repete enquanto o preço segue abaixo e volta a avisar depois que o preço sobe e cai de novo.
- **Sem sinal:** tudo é gravado primeiro no aparelho. O indicador no topo mostra *sincronizado*, *N pendentes* ou *erro*. Ler oferta e coletar agora precisam de rede.

## Testes

```bash
node testes/rodar.js        # núcleo do app + Code.gs numa planilha em memória (sem dependências)
npm i && npm run e2e        # uso completo no Edge headless (NAVEGADOR=... para outro Chromium)
```

No celular, abra `index.html?test` para rodar os testes do núcleo no navegador.

O `rodar.js` e o `e2e.js` executam o próprio `Code.gs` dentro de um ambiente falso do Apps Script ([testes/gas-falso.js](testes/gas-falso.js)). As lojas são simuladas com as páginas de [testes/fixtures/](testes/fixtures/). O e2e salva capturas de tela em `testes/capturas/`.

## Decisões de implementação

| Ponto | Decisão |
| --- | --- |
| Cotação automática | Uma linha por monitor por dia, com ID `auto_<monitor>_<AAAA-MM-DD>`. Recoletar no mesmo dia faz upsert: `preco` fica com o último valor e `preco_min_dia` só aceita valor menor (opção `minimo` do upsert, interna ao script). |
| Ordem dos adaptadores | VTEX (API pública de catálogo) → Shopify (`/products/<handle>.js`) → JSON-LD → metatags. O adaptador que funcionou fica gravado no monitor e é tentado primeiro na próxima vez. |
| Sabor (SKU) | O monitor guarda o SKU escolhido. Se ele sumir de uma página com vários sabores, a coleta dá erro com o motivo. Numa página de um sabor só, um SKU diferente é aceito. |
| Frete | Lojas VTEX com CEP na Config: simulação pública de carrinho. Se a loja recusar (403), o bloqueio fica 6 h em cache e vale a regra da loja. Demais lojas: sempre a regra da loja. |
| Custo efetivo | Calculado no app (não gravado), para que corrigir peso, dose ou regra da loja corrija todo o histórico. O robô usa a mesma função para decidir o alerta; `rodar.js` confere que as duas dão o mesmo resultado. |
| Cupom e PIX | Aplicados em sequência (cupom primeiro). Frete grátis compara com o valor já com desconto. |
| Ranking | Cotação mais recente de cada par produto–loja dentro da janela. Produto sem peso, dose ou proteína vai para o fim. |
| Menor já visto | Calculado no bootstrap sobre todas as cotações; o celular guarda só os últimos `historico_dias` (180). |
| Coleta pelo app | `acao=coletar` processa até ~20 s por chamada e devolve quantos faltam; o app repete até acabar. O filtro `antes` evita revisitar o que já foi coletado nesse clique. |
| Rodada do gatilho | Até ~4,5 min, do link coletado há mais tempo para o mais recente. O que sobrar vai primeiro na rodada seguinte. |
| Concorrência | O robô baixa as páginas fora do lock e grava sob o mesmo `LockService` do app. Monitores apagados durante a coleta não são recriados. |
| Pausa entre requisições | 2 s por loja (`pausa_entre_req_ms`). Uma loja Shopify testada já devolve 429 com poucas requisições seguidas. |
| Arquivar produto | Desativa também os links dele no robô. |
| Datas | Gravadas como texto ISO 8601 com fuso (`2026-10-30T07:30:00-03:00`). As colunas de data, ID, SKU, URL e `valor` (por causa do CEP) usam formato texto. |
| Segurança | O token vai na query do GET e no corpo do POST, e é comparado com as Script Properties. Valores começando com `= + - @` são gravados como texto. |

## Limitações conhecidas

- **Lojas que bloqueiam robôs:** Mercado Livre, Amazon, Netshoes, Centauro e Drogasil recusaram a leitura nos testes (30/10/2026). Use cotação manual para elas. As APIs oficiais do Mercado Livre e da Amazon não servem para uso pessoal hoje (detalhes no documento de requisitos).
- **Testes feitos de uma conexão residencial:** os IPs do Google podem ser mais bloqueados. Rode `testarColeta` depois da instalação para ver o resultado real; os links que falharem serão pausados após 5 tentativas.
- **Frete real:** a simulação VTEX devolveu 403 nas duas lojas testadas. Na prática, conte com as regras de frete de cada loja.
- **Páginas com vários tamanhos (JSON-LD):** algumas lojas, como a Growth, publicam para robôs só o preço do tamanho pré-selecionado na página (na Growth, 450 g, preço de cartão). Cadastre o produto com esse peso e informe o desconto do PIX na loja. Nas lojas VTEX e Shopify cada tamanho ou sabor é lido separadamente.
- **HTML muda:** JSON-LD e metatags dependem do tema da loja. Se a loja trocar o site, o link passa a dar erro e é pausado.
- **Termos de uso:** muitas lojas proíbem coleta automatizada. O robô lê só os links cadastrados, poucas vezes por dia e sem contornar bloqueios. O risco de usar é seu.
- **Cotas do Google (conta gratuita):** 20.000 leituras por dia, 90 min de gatilhos por dia e 100 e-mails por dia. Com 60 links a cada 6 h o uso fica em torno de 500 leituras e 15 min por dia.
- **Abrir sem rede:** não funciona, porque não há service worker (RT-23). Uma vez aberto, ranking, histórico e cotação manual funcionam offline.
- **Editar a planilha à mão:** fique à vontade, mas não altere a primeira coluna (ID). O app baixa os dados novos ao abrir e ao voltar para ele depois de 10 min, desde que não haja envios pendentes.
