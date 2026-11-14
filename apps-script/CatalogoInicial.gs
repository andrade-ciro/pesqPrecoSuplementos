/**
 * Catálogo inicial: 10 marcas de whey com bom custo-benefício e até 5 lojas legíveis pelo robô para cada uma.
 * Pesquisado e validado em 14/11/2026: todos os links abaixo foram lidos com sucesso pelo extrator do Code.gs.
 * Os preços nos comentários são os daquela data, só para referência.
 *
 * Como usar: no editor do Apps Script, crie o arquivo (Arquivos > + > Script) com o nome CatalogoInicial,
 * cole este conteúdo, salve e rode carregarCatalogoInicial(). Pode rodar de novo: não duplica nada.
 * Precisa do Code.gs 1.2.0 ou mais novo (carregarCatalogo_). Lojas já cadastradas são reaproveitadas pelo site;
 * produtos, pela marca, nome e peso; links já monitorados, pelo endereço. Não sobrescreve o que você editou.
 *
 * Proteína por porção: valores de fontes públicas (rótulo, lojas), anotados em obs. Confira no rótulo.
 */

const LOJAS_CATALOGO = {
  "www.maxtitanium.com.br": ["Max Titanium", "vtex"],
  "www.atacadao.com.br": ["Atacadão", "vtex"],
  "www.drogariasaopaulo.com.br": ["Drogaria São Paulo", "vtex"],
  "www.drogariaspacheco.com.br": ["Drogarias Pacheco", "vtex"],
  "www.drogal.com.br": ["Drogal", "vtex"],
  "www.probiotica.com.br": ["Probiótica", "vtex"],
  "www.samsclub.com.br": ["Sam's Club", "vtex"],
  "www.drogariavenancio.com.br": ["Drogaria Venâncio", "vtex"],
  "www.paguemenos.com.br": ["Pague Menos", "vtex"],
  "www.extrafarma.com.br": ["Extrafarma", "vtex"],
  "www.blackskullusa.com.br": ["Black Skull", "vtex"],
  "www.vitafor.com.br": ["Vitafor", "vtex"],
  "www.truesource.com.br": ["True Source", "shopify"],
  "www.optimumnutrition.com.br": ["Optimum Nutrition", "shopify"],
  "www.gsuplementos.com.br": ["Growth Supplements", "outra"],
  "www.darklabsuplementos.com.br": ["Dark Lab", "shopify"],
  "www.3vsnutrition.com.br": ["3VS Nutrition", "shopify"],
};

const CATALOGO_INICIAL = [
  { marca: "Max Titanium", nome: "100% Whey 900 g", tipo: "concentrado", sabor: '', peso_g: 900, dose_g: 30, proteina_dose_g: 21,
    obs: "Proteína: 21 g em 30 g (Extrafarma/Drogasil). Outros produtos da marca (Whey Blend, Whey Pro) foram reprovados no levantamento da Abenutri com amostras de 2022, contestado pela indústria.",
    links: [
      ["www.maxtitanium.com.br", "https://www.maxtitanium.com.br/100-whey-refil-900g/p", "1497", "Chocolate", "vtex"], // R$ 196.39
      ["www.atacadao.com.br", "https://www.atacadao.com.br/suplemento-alimentar-max-100--whey-chocolate-4900/p", "57153", "Suplemento Alimentar Max 100% Whey Chocolate 900g", "vtex"], // R$ 159.00
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/whey-protein-100-max-titanium-chocolate-900g-refil/p", "850047", "Whey Protein 100% Max Titanium Chocolate 900g Refil", "vtex"], // R$ 179.99
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/whey-protein-100-max-titanium-chocolate-900g-refil/p", "850047", "Whey Protein 100% Max Titanium Chocolate 900g Refil", "vtex"], // R$ 195.59
      ["www.drogal.com.br", "https://www.drogal.com.br/suplemento-alimentar-proteico-em-po-max-titanium-100-whey-cookies-cream-900g/p", "14", "Suplemento Alimentar Proteico em Pó Max Titanium 100% Whey Cookies & Cream 900g", "vtex"], // R$ 204.99
    ] },
  { marca: "Probiótica", nome: "100% Pure Whey 900 g", tipo: "concentrado", sabor: '', peso_g: 900, dose_g: 30, proteina_dose_g: 20,
    obs: "Proteína: a marca informa de 20 a 24 g por porção de 30 g, conforme o sabor; usado o menor valor.",
    links: [
      ["www.probiotica.com.br", "https://www.probiotica.com.br/100-pure-whey-pote-900g/p", "1653", "Chocolate Branco", "vtex"], // R$ 252.49
      ["www.samsclub.com.br", "https://www.samsclub.com.br/100-pure-whey-pote-900g-caramelo-salgado-7899941207660/p", "148137", "", "jsonld"], // R$ 159.98
      ["www.drogal.com.br", "https://www.drogal.com.br/suplemento-alimentar-proteico-100-pure-whey-probiotica-sabor-chocolate-900g/p", "16742", "Suplemento Alimentar Proteico Probiótica 100% Pure Whey Sabor Chocolate 900g", "vtex"], // R$ 174.24
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/suplemento-alimentar-100-pure-whey-probiotica-sabor-baunilha-900g/p", "124922", "Suplemento Alimentar 100% Pure Whey Probiótica sabor Baunilha 900g", "vtex"], // R$ 229.90
    ] },
  { marca: "Dux", nome: "Whey Protein Concentrado 900 g", tipo: "concentrado", sabor: '', peso_g: 900, dose_g: 30, proteina_dose_g: 23,
    obs: "Proteína: 23 g em 30 g (descrição na Pague Menos).",
    links: [
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/dux-human-whey-protein-choc-concentrado-900g/p", "100719", "Whey Protein Concentrado Dux Human Health Chocolate 900g", "vtex"], // R$ 289.90
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/dux-company-whey-protein-concentrado-pote-900g-17a926x1183804u717926k11l84p0806/p", "999852695", "WHEY PROTEIN CONCENTRADO - POTE 900G Chocolate Chocolate Belga", "vtex"], // R$ 293.50
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/dux-company-whey-protein-concentrado-pote-900g-1790107nq7i36126/p", "1646356", "WHEY PROTEIN CONCENTRADO - POTE 900G Chocolate Branco", "vtex"], // R$ 293.50
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/dux-company-whey-protein-concentrado-pote-900g-1790107nq7i36126/p", "1646356", "WHEY PROTEIN CONCENTRADO - POTE 900G Chocolate Branco", "vtex"], // R$ 293.50
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/whey-protein-concentrado-dux-human-health-chocolate-branco-900g/p", "916609", "Whey Protein Concentrado Dux Human Health Chocolate Branco 900g", "vtex"], // R$ 359.99
    ] },
  { marca: "Black Skull", nome: "Whey 100% HD 900 g", tipo: "blend", sabor: '', peso_g: 900, dose_g: 30, proteina_dose_g: 21,
    obs: "Proteína: 21 g em 30 g (Drogasil/Extrafarma). Blend de WPC, WPI e WPH.",
    links: [
      ["www.blackskullusa.com.br", "https://www.blackskullusa.com.br/whey-100-hd-black-skull-900g-wpc-wpi-e-wph/p", "303", "Whey 100% HD Chocolate 900g", "vtex"], // R$ 169.90
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/whey-protein-refil-black-skull-900g-wpi-wpc-wph--172356261c901qr8-1/p", "150622", "Whey Protein Refil - Black Skull - 900g (WPI, WPC, WPH) - CHOCOLATE", "vtex"], // R$ 114.90
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/whey-protein-refil-black-skull-900g-wpi-wpc-wph--172356261c901qr8-1/p", "150622", "Whey Protein Refil - Black Skull - 900g (WPI, WPC, WPH) - CHOCOLATE", "vtex"], // R$ 114.90
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/whey-100--hd-black-skull-choc-900g/p", "95974", "Whey 100% HD Black Skull Sabor Chocolate 900g", "vtex"], // R$ 179.00
    ] },
  { marca: "Vitafor", nome: "Isofort WPI 900 g", tipo: "isolado", sabor: '', peso_g: 900, dose_g: 30, proteina_dose_g: 26,
    obs: "Proteína: 26 g em 30 g (Drogasil/Araujo); há fontes com 28 g no sabor neutro.",
    links: [
      ["www.vitafor.com.br", "https://www.vitafor.com.br/whey-protein-isolado---isofort---900g-chocolate---vitafor/p", "15", "ISOFORT® WPI: Whey Protein Isolado Sabor Chocolate 900g", "vtex"], // R$ 334.75
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/isofort-900g-chocolate-vitafor-1g72r658t9788515/p", "150907", "Isofort 900g Chocolate Vitafor", "vtex"], // R$ 374.90
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/isofort-900g-chocolate-vitafor-1g72r658t9788515/p", "150907", "Isofort 900g Chocolate Vitafor", "vtex"], // R$ 374.90
      ["www.drogariavenancio.com.br", "https://www.drogariavenancio.com.br/isofort-wpi-vitafor-chocolate-900g/p", "99951", "Supemento Alimentar Isofort WPI Vitafor sabor Chocolate 900g", "vtex"], // R$ 399.90
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/whey-protein-isofort-vitafor-900g-baunilha-ffp1789062647967/p", "999843198", "Whey Protein Isofort Vitafor 900g Baunilha", "vtex"], // R$ 436.90
    ] },
  { marca: "True Source", nome: "True Whey 837 g", tipo: "hidrolisado", sabor: '', peso_g: 837, dose_g: 32, proteina_dose_g: 23,
    obs: "Proteína: 23 g em 32 g (tabela na Drogaria São Paulo). Blend de isolado e hidrolisado.",
    links: [
      ["www.truesource.com.br", "https://www.truesource.com.br/products/true-whey-protein-creme-brulee-837g", "44930767323322", "Comprar apenas uma vez", "shopify"], // R$ 499.90
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/true-whey-protein-dark-chocolate-837g-yv17792y17683259/p", "999820208", "True Whey Protein Dark Chocolate 837G", "vtex"], // R$ 374.93
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/true-whey-protein-chocolate-com-avela-837g-177i92190oo81317/p", "935459099", "True Whey Protein Chocolate Com Avelã 837G", "vtex"], // R$ 374.93
      ["www.paguemenos.com.br", "https://www.paguemenos.com.br/true-source-whey-iso-hidro-dark-chocolate-837g-1p75509484tx4101/p", "175290", "True Source Whey Iso/Hidro - Dark Chocolate 837g", "vtex"], // R$ 449.90
      ["www.extrafarma.com.br", "https://www.extrafarma.com.br/true-source-whey-iso-hidro-dark-chocolate-837g-1p75509484tx4101/p", "175290", "True Source Whey Iso/Hidro - Dark Chocolate 837g", "vtex"], // R$ 449.90
    ] },
  { marca: "Optimum Nutrition", nome: "Gold Standard 100% Whey 907 g", tipo: "blend", sabor: '', peso_g: 907, dose_g: 30, proteina_dose_g: 24,
    obs: "Proteína: 24 g por porção (loja oficial).",
    links: [
      ["www.optimumnutrition.com.br", "https://www.optimumnutrition.com.br/products/gold-standard-100-whey-protein-powder", "47564626657411", "Chocolate Extra Intenso / 909g", "shopify"], // R$ 450.00
      ["www.drogariasaopaulo.com.br", "https://www.drogariasaopaulo.com.br/whey-gold-standard-optimum-nutrition-chocolate-899g-17p8906262d682d2/p", "999844371", "Whey Gold Standard Optimum Nutrition Chocolate 899g", "vtex"], // R$ 444.90
      ["www.drogariaspacheco.com.br", "https://www.drogariaspacheco.com.br/whey-gold-standard-optimum-nutrition-chocolate-899g-r17891415599nn63/p", "999837197", "Whey Gold Standard Optimum Nutrition Chocolate 899g", "vtex"], // R$ 444.90
    ] },
  { marca: "Growth", nome: "TOP Whey Protein Concentrado 1 kg", tipo: "concentrado", sabor: '', peso_g: 1000, dose_g: 30, proteina_dose_g: 24,
    obs: "Proteína: a linha TOP é o concentrado 80 % da Growth; 24 g em 30 g estimado, confira no rótulo. O preço publicado é o de cartão (PIX 10 % menor).",
    links: [
      ["www.gsuplementos.com.br", "https://www.gsuplementos.com.br/whey-protein-concentrado-1kg-growth-supplements-p985936", "33", "", "jsonld"], // R$ 199.88
    ] },
  { marca: "Dark Lab", nome: "100% Whey Refil 900 g", tipo: "concentrado", sabor: '', peso_g: 900, dose_g: 30, proteina_dose_g: 21,
    obs: "Proteína: 21 g por dose (loja oficial).",
    links: [
      ["www.darklabsuplementos.com.br", "https://www.darklabsuplementos.com.br/products/whey-100-refil-900g-dark-lab-1", "42933630271694", "CHOCOLATE", "shopify"], // R$ 129.90
    ] },
  { marca: "3VS Nutrition", nome: "Whey Hidrolisada 900 g", tipo: "hidrolisado", sabor: '', peso_g: 900, dose_g: 30, proteina_dose_g: "",
    obs: "Proteína por porção não publicada: confira no rótulo e preencha.",
    links: [
      ["www.3vsnutrition.com.br", "https://www.3vsnutrition.com.br/products/100-whey-hidrolizada", "55335820427432", "CHOCOLATE", "shopify"], // R$ 316.99
    ] },
];

function carregarCatalogoInicial() {
  return carregarCatalogo_(LOJAS_CATALOGO, CATALOGO_INICIAL.map(function (c) { return Object.assign({ categoria: 'whey' }, c); }), 'Catálogo de whey');
}
