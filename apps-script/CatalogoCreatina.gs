/**
 * Catálogo de creatina: 19 produtos das principais marcas, em até 5 lojas legíveis pelo robô cada um.
 * Pesquisado e validado em 14/11/2026: todos os links abaixo foram lidos com sucesso pelo extrator do Code.gs.
 * Os preços nos comentários são os daquela data, só para referência.
 *
 * Como usar: no editor do Apps Script, crie o arquivo (Arquivos > + > Script) com o nome CatalogoCreatina,
 * cole este conteúdo, salve e rode carregarCatalogoCreatina(). Precisa do Code.gs 1.2.0 ou mais novo.
 * Pode rodar de novo: não duplica nada e não sobrescreve o que você editou no app.
 *
 * Creatina por dose: 3 g por dose de 3 g, do rótulo (monohidratada pura). Se tiver laudo, informe no app.
 */

const LOJAS_CREATINA = {
  "www.drogariavenancio.com.br": ["Drogaria Venâncio", "vtex"],
  "www.drogariaspacheco.com.br": ["Drogarias Pacheco", "vtex"],
  "www.atacadao.com.br": ["Atacadão", "vtex"],
  "www.drogal.com.br": ["Drogal", "vtex"],
  "www.samsclub.com.br": ["Sam's Club", "vtex"],
  "www.maxtitanium.com.br": ["Max Titanium", "vtex"],
  "www.probiotica.com.br": ["Probiótica", "vtex"],
  "www.blackskullusa.com.br": ["Black Skull", "vtex"],
  "www.paguemenos.com.br": ["Pague Menos", "vtex"],
  "www.extrafarma.com.br": ["Extrafarma", "vtex"],
  "www.vitafor.com.br": ["Vitafor", "vtex"],
  "www.drogariasaopaulo.com.br": ["Drogaria São Paulo", "vtex"],
  "www.gsuplementos.com.br": ["Growth Supplements", "outra"],
  "www.darklabsuplementos.com.br": ["Dark Lab", "shopify"],
  "www.soldiersnutrition.com.br": ["Soldiers Nutrition", "shopify"],
  "www.optimumnutrition.com.br": ["Optimum Nutrition", "shopify"],
  "www.truesource.com.br": ["True Source", "shopify"],
};

const CATALOGO_CREATINA = [
  { marca: "Integralmédica", nome: "Creatina Hardcore 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/creatina-hardcore-integralmedica-300g/p", "19544", "Creatina Hardcore Integralmédica 300g", "vtex"], // R$ 44.99
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/creatina-monohidratada-integralmedica-300g/p", "887188", "Creatina Monohidratada Integralmedica 300g", "vtex"], // R$ 46.34
      ["www.atacadao.com.br", "https://www.atacadao.com.br/suplemento-alimentar-integralmedica-creatina-16823/p", "63052", "Suplemento Alimentar Integralmedica Creatina 300g", "vtex"], // R$ 49.90
      ["www.drogal.com.br", "https://www.drogal.com.br/creatina-em-po-integralmedica-hardcore-300g/p", "16650", "Creatina em Pó Integralmedica Hardcore 300g", "vtex"], // R$ 58.69
      ["www.samsclub.com.br", "https://www.samsclub.com.br/creatina-hardcore-integralmedica-300g-7896311708314/p", "82014", "", "jsonld"], // R$ 59.98
    ] },
  { marca: "Max Titanium", nome: "Creatina 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.maxtitanium.com.br", "https://www.maxtitanium.com.br/creatina-pote-300g/p", "31", "MonoHidratada", "vtex"], // R$ 59.90
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/suplemento-alimentar-de-creatina-em-po-max-titanium-creatine-300g/p", "85698", "Suplemento Alimentar De Creatina Em Pó Max Titanium Creatine 300g", "vtex"], // R$ 45.69
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/creatina-po-max-titanium-300g/p", "838683", "Creatina Pó Max Titanium 300g", "vtex"], // R$ 45.72
      ["www.samsclub.com.br", "https://www.samsclub.com.br/creatina-po-max-titanium-pote-300g-7898920041448/p", "144530", "", "jsonld"], // R$ 49.98
      ["www.drogal.com.br", "https://www.drogal.com.br/suplemento-alimentar-creatina-max-titanium-300g/p", "14503", "Suplemento Alimentar Creatina Max Titanium 300g", "vtex"], // R$ 59.89
    ] },
  { marca: "Max Titanium", nome: "Creatina 1 kg", tipo: "monohidratada", sabor: '', peso_g: 1000, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Mesma creatina do pote de 300 g. Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.maxtitanium.com.br", "https://www.maxtitanium.com.br/creatina-1kg/p", "3008", "MonoHidratada", "vtex"], // R$ 109.90
    ] },
  { marca: "Probiótica", nome: "Creatina Monohidratada 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.probiotica.com.br", "https://www.probiotica.com.br/creatina-300g/p", "31", "Monohidratada", "vtex"], // R$ 59.90
      ["www.drogal.com.br", "https://www.drogal.com.br/creatina-em-po-monohidratada-probiotica-300g/p", "16554", "Suplemento Alimentar Creatina Probiótica Monohidratada 300g", "vtex"], // R$ 54.89
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/suplemento-alimentar-creatina-monohidratada-probiotica-300g/p", "72763", "Suplemento Alimentar Creatina Monohidratada Probiótica 300g", "vtex"], // R$ 58.90
    ] },
  { marca: "Black Skull", nome: "Creatine Monohidratada 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.blackskullusa.com.br", "https://www.blackskullusa.com.br/creatine-creatina-monohidratada-300g/p", "62", "Creatine 300g", "vtex"], // R$ 49.90
    ] },
  { marca: "Black Skull", nome: "Creator Creatina Monohidratada 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Linha mais barata da Black Skull; não estava na lista analisada pela Anvisa.",
    links: [
      ["www.blackskullusa.com.br", "https://www.blackskullusa.com.br/creator--creatina-monohidratada--300g/p", "67", "Creator - Creatina Monohidratada - 300g", "vtex"], // R$ 29.90
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/creator-creatina-monohidratada-300g-za17235626d18745/p", "148408", "Creator - Creatina Monohidratada 300g", "vtex"], // R$ 29.90
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/creator-creatina-monohidratada-300g-za17235626d18745/p", "148408", "Creator - Creatina Monohidratada 300g", "vtex"], // R$ 29.90
    ] },
  { marca: "Vitafor", nome: "Creatine Monohidratada 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo).",
    links: [
      ["www.vitafor.com.br", "https://www.vitafor.com.br/creatine---300g---vitafor/p", "56", "CREATINE: Creatina Monohidratada 300g", "vtex"], // R$ 63.70
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/suplemento-alimentar-vitafor-creatine-300g/p", "85873", "Suplemento Alimentar em Pó Vitafor Creatine 300g", "vtex"], // R$ 100.99
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/creatine-vitafor-300g/p", "1644094", "Creatine Vitafor 300g", "vtex"], // R$ 129.99
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/creatine-vitafor-300g/p", "1644094", "Creatine Vitafor 300g", "vtex"], // R$ 129.99
    ] },
  { marca: "Dux", nome: "Creatina Monohidratada 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo).",
    links: [
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/creatina-monohidratada-dux-nutrition-lab-300g-em-po/p", "843814", "Creatina Monohidratada Dux Nutrition Lab 300g em Pó", "vtex"], // R$ 75.90
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/creatina-monohidratada-dux-nutrition-lab-300g-em-po/p", "843814", "Creatina Monohidratada Dux Nutrition Lab 300g em Pó", "vtex"], // R$ 75.90
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/creatina-dux-300g/p", "92633", "Creatina Monohidratada Dux Nutrition 300g", "vtex"], // R$ 75.90
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/dux-company-creatina-monohidratada-pote-300g-179z01y0314154g7/p", "1646416", "Creatina Monohidratada Dux Human Health 300g 60 Doses", "vtex"], // R$ 89.90
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/dux-company-creatina-monohidratada-pote-300g-179z01y0314154g7/p", "1646416", "Creatina Monohidratada Dux Human Health 300g 60 Doses", "vtex"], // R$ 89.90
    ] },
  { marca: "Growth", nome: "Creatina Monohidratada 250 g", tipo: "monohidratada", sabor: '', peso_g: 250, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Preço publicado é o de cartão.",
    links: [
      ["www.gsuplementos.com.br", "https://www.gsuplementos.com.br/creatina-monohidratada-250gr-growth-supplements-p985931", "20001", "", "jsonld"], // R$ 55.44
    ] },
  { marca: "Dark Lab", nome: "Creatina 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.darklabsuplementos.com.br", "https://www.darklabsuplementos.com.br/products/creatina-300g-monohidratada-dark-lab", "42941289889998", "", "shopify"], // R$ 39.89
    ] },
  { marca: "Dark Lab", nome: "Creatina Refil 1 kg", tipo: "monohidratada", sabor: '', peso_g: 1000, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Refil. Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.darklabsuplementos.com.br", "https://www.darklabsuplementos.com.br/products/creatina-refil-1kg-monohidratada-dark-lab", "43086509506766", "", "shopify"], // R$ 82.89
    ] },
  { marca: "Soldiers Nutrition", nome: "Creatina Monohidratada 1 kg", tipo: "monohidratada", sabor: '', peso_g: 1000, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada). Atenção: em 2025 a polícia interditou uma fábrica contratada pela marca (investigação de fraude); confira notícias antes de comprar.",
    links: [
      ["www.soldiersnutrition.com.br", "https://www.soldiersnutrition.com.br/products/creatina-monohidratada-100-pura-importada-soldiers-nutrition-tamanho-1kg", "47173659492601", "1Kg", "shopify"], // R$ 72.53
    ] },
  { marca: "Optimum Nutrition", nome: "Micronized Creatine Powder 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Pote de 300 g. Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.optimumnutrition.com.br", "https://www.optimumnutrition.com.br/products/creatine-monohydrate-micronized-powder", "47564720373891", "Sem sabor / 300g", "shopify"], // R$ 100.00
    ] },
  { marca: "True Source", nome: "True Creatine 100% Pure 300 g", tipo: "monohidratada", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.truesource.com.br", "https://www.truesource.com.br/products/creatine-pure-300g", "44930905538746", "Comprar apenas uma vez", "shopify"], // R$ 109.90
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/true-creatine-100-pure-300g-e17w7921749s4355/p", "999820310", "True Creatine 100% Pure 300G", "vtex"], // R$ 82.43
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/true-creatine-100-pure-300g-s1779o21906t1912/p", "935459006", "True Creatine 100% Pure 300G", "vtex"], // R$ 82.43
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/suplemento-alimentar-em-po-true-creatina-100-pure-300g/p", "123206", "Suplemento Alimentar em Pó True Creatina 100% Pure 300g", "vtex"], // R$ 109.90
    ] },
  { marca: "Dux", nome: "Creatina Creapure 300 g", tipo: "creapure", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Creapure: creatina monohidratada fabricada pela AlzChem (Alemanha), selo de pureza; o efeito é o mesmo da monohidratada comum. Monohidratada: 3 g de creatina por dose de 3 g (rótulo).",
    links: [
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/creatina-creapure-dux-300g/p", "94346", "Creapure Creatina Dux 300g", "vtex"], // R$ 245.89
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/creatina-monohidratada-ultra-pura-dux-creapure-300g-po/p", "882356", "Creatina Monohidratada Ultra Pura Dux Creapure 300g Pó", "vtex"], // R$ 253.27
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/creatina-monohidratada-ultra-pura-dux-creapure-300g-po/p", "882356", "Creatina Monohidratada Ultra Pura Dux Creapure 300g Pó", "vtex"], // R$ 286.99
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/creatina-creapure-dux-300g/p", "172985", "Creatina Creapure Dux Monohidratada Sem Sabor 300g", "vtex"], // R$ 286.99
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/creatina-creapure-dux-300g/p", "172985", "Creatina Creapure Dux Monohidratada Sem Sabor 300g", "vtex"], // R$ 286.99
    ] },
  { marca: "Vitafor", nome: "Creafort Creapure 300 g", tipo: "creapure", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Creapure: creatina monohidratada fabricada pela AlzChem (Alemanha), selo de pureza; o efeito é o mesmo da monohidratada comum. Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Produto da marca na análise da Anvisa/INCQS divulgada em abr/2025 (40 de 41 creatinas com teor dentro da tolerância de 20 %; a reprovada não foi divulgada).",
    links: [
      ["www.vitafor.com.br", "https://www.vitafor.com.br/creafort--creapure----300g---vitafor/p", "68", "CREAFORT® Creatina Creapure 300g", "vtex"], // R$ 180.70
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/creafort-creatina-100-creapure-300g-vitafor-17s265888a0558m7/p", "151027", "Creafort Creatina 100% Creapure 300g Vitafor", "vtex"], // R$ 202.90
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/creafort-creatina-100-creapure-300g-vitafor-17s265888a0558m7/p", "151027", "Creafort Creatina 100% Creapure 300g Vitafor", "vtex"], // R$ 202.90
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/creafort-vitafor-300g-935158392/p", "935158382", "Creafort Vitafor 300g", "vtex"], // R$ 224.10
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/creafort-vitafor-300g-935155435/p", "935155426", "Creafort Vitafor 300g", "vtex"], // R$ 224.10
    ] },
  { marca: "True Source", nome: "True Creatine Creapure 300 g", tipo: "creapure", sabor: '', peso_g: 300, dose_g: 3, proteina_dose_g: 3,
    obs: "Creapure: creatina monohidratada fabricada pela AlzChem (Alemanha), selo de pureza; o efeito é o mesmo da monohidratada comum. Monohidratada: 3 g de creatina por dose de 3 g (rótulo).",
    links: [
      ["www.truesource.com.br", "https://www.truesource.com.br/products/true-creatine-monohydrate-creapure-300g", "44930904162490", "Comprar apenas uma vez", "shopify"], // R$ 279.90
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/true-creatine-monohydrate-creapure-300g-177r921750d9h328/p", "999820293", "True Creatine Monohydrate Creapure 300G", "vtex"], // R$ 209.93
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/true-creatine-monohydrate-creapure-300g-17l79s21916s3436/p", "935458972", "True Creatine Monohydrate Creapure 300G", "vtex"], // R$ 209.93
    ] },
  { marca: "Growth", nome: "Creatina Creapure 250 g", tipo: "creapure", sabor: '', peso_g: 250, dose_g: 3, proteina_dose_g: 3,
    obs: "Creapure: creatina monohidratada fabricada pela AlzChem (Alemanha), selo de pureza; o efeito é o mesmo da monohidratada comum. Monohidratada: 3 g de creatina por dose de 3 g (rótulo). Preço publicado é o de cartão.",
    links: [
      ["www.gsuplementos.com.br", "https://www.gsuplementos.com.br/creatina-250g-creapure-growth-supplements-p985824", "10001", "", "jsonld"], // R$ 122.11
    ] },
  { marca: "Max Titanium", nome: "Creatina Creapure 250 g", tipo: "creapure", sabor: '', peso_g: 250, dose_g: 3, proteina_dose_g: 3,
    obs: "Creapure: creatina monohidratada fabricada pela AlzChem (Alemanha), selo de pureza; o efeito é o mesmo da monohidratada comum. Monohidratada: 3 g de creatina por dose de 3 g (rótulo).",
    links: [
      ["www.maxtitanium.com.br", "https://www.maxtitanium.com.br/creatina-creapure-250g/p", "1180", "Pote 250g", "vtex"], // R$ 139.89
    ] },
];

function carregarCatalogoCreatina() {
  return carregarCatalogo_(LOJAS_CREATINA, CATALOGO_CREATINA.map(function (c) { return Object.assign({ categoria: 'creatina' }, c); }), 'Catálogo de creatina');
}
