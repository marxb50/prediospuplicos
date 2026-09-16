/**
 * =========================================================================
 * SELIM - COORDENADORIA DE LIMPEZA URBANA DE PARNAMIRIM
 * API de registro fotográfico e relatórios de prédios públicos
 * =========================================================================
 *
 * A API grava as fotos no Google Drive, registra uma linha por execução na
 * planilha e entrega os dados completos para a página de relatório A4.
 */

const NOME_PASTA_PRINCIPAL = "fotos selim predios publicos";
const NOME_PLANILHA = "Controle de Fotos - Prédios Públicos SELIM";
const NOME_ABA_REGISTROS = "Registros SELIM";
const FUSO_HORARIO = "GMT-03:00";

const CABECALHOS_REGISTROS = [
  "Carimbo de Data/Hora",
  "Data da Execução",
  "Categoria",
  "Prédio Público",
  "Endereço",
  "Qtd Fotos",
  "Link da Pasta no Google Drive (Todas as Fotos)",
  "Responsável",
  "Observações",
  "Links Individuais das Fotos",
  "ID do Registro",
  "Chave de Exclusão"
];

/** Responde ao healthcheck ou ao pedido de dados do relatório. */
function doGet(e) {
  const parametros = (e && e.parameter) ? e.parameter : {};

  if (parametros.acao === "relatorio" || parametros.action === "report") {
    return responderJson(obterRelatorio(parametros));
  }

  if (parametros.acao === "estatisticas" || parametros.action === "statistics") {
    return responderJson(obterDadosEstatisticos(parametros));
  }

  return responderJson({
    status: "ok",
    app: "SELIM Prédios Públicos API",
    versao: "1.2",
    dataHoraServidor: new Date().toISOString(),
    mensagem: "O Web App do Google Apps Script está ativo e pronto para receber fotos e relatórios."
  });
}

/** Entrega somente os dados operacionais usados nos cálculos estatísticos. */
function obterDadosEstatisticos(parametros) {
  try {
    const pastaRaiz = obterOuCriarPastaRaiz(NOME_PASTA_PRINCIPAL);
    const arquivoPlanilha = pastaRaiz.getFilesByName(NOME_PLANILHA);

    if (!arquivoPlanilha.hasNext()) {
      return {
        status: "success",
        acao: "estatisticas",
        registros: []
      };
    }

    const planilha = SpreadsheetApp.openById(arquivoPlanilha.next().getId());
    const aba = garantirAbaRegistros(planilha);
    const valores = aba.getDataRange().getDisplayValues();
    const inicio = parametros.inicio ? converterData(parametros.inicio) : null;
    const fim = parametros.fim ? converterData(parametros.fim) : null;
    if (fim) fim.setHours(23, 59, 59, 999);
    const categoriaFiltro = String(parametros.categoria || "").trim().toLowerCase();
    const registros = [];

    for (let i = 1; i < valores.length; i++) {
      const linha = valores[i];
      if (!linha || !linha[1]) continue;

      const dataExecucao = converterData(linha[1]);
      if (inicio && (!dataExecucao || dataExecucao < inicio)) continue;
      if (fim && (!dataExecucao || dataExecucao > fim)) continue;
      if (categoriaFiltro && String(linha[2] || "").trim().toLowerCase() !== categoriaFiltro) continue;

      registros.push({
        timestamp: linha[0] || "",
        dataExecucao: linha[1] || "",
        dataIso: dataExecucao ? Utilities.formatDate(dataExecucao, FUSO_HORARIO, "yyyy-MM-dd") : "",
        categoria: linha[2] || "Geral",
        predioNome: linha[3] || "Prédio não informado",
        endereco: linha[4] || "Endereço não informado",
        responsavel: linha[7] || "Não informado"
      });
    }

    registros.sort(function(a, b) {
      return String(b.dataIso || b.dataExecucao).localeCompare(String(a.dataIso || a.dataExecucao));
    });

    return {
      status: "success",
      acao: "estatisticas",
      totalExecucoes: registros.length,
      registros: registros,
      sheetUrl: planilha.getUrl()
    };
  } catch (error) {
    Logger.log("Erro ao montar estatísticas: " + error.toString());
    return {
      status: "error",
      message: error.message || error.toString()
    };
  }
}

/** Recebe os dados do aplicativo e salva a execução no Drive e na planilha. */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Nenhum dado recebido na requisição POST.");
    }

    const payload = JSON.parse(e.postData.contents);

    if (payload.acao === "excluirRegistro" || payload.action === "deleteRecord") {
      return responderJson(excluirRegistro(payload));
    }

    if (payload.acao === "adicionarFotos" || payload.action === "appendPhotos") {
      return responderJson(adicionarFotosARegistro(payload));
    }

    const categoria = payload.categoria || "Geral";
    const predioNome = payload.predioNome || "Prédio Não Identificado";
    const endereco = payload.endereco || "Endereço não informado";
    const dataExecucao = payload.dataExecucao || Utilities.formatDate(new Date(), FUSO_HORARIO, "dd/MM/yyyy");
    const responsavel = payload.responsavel || "Não informado";
    const observacoes = payload.observacoes || "";
    const fotos = Array.isArray(payload.fotos) ? payload.fotos.slice(0, 20) : [];

    const pastaRaiz = obterOuCriarPastaRaiz(NOME_PASTA_PRINCIPAL);
    const dataFormatadaPasta = dataExecucao.replace(/\//g, "-").replace(/\./g, "-");
    const nomeSubpasta = `[${dataFormatadaPasta}] ${predioNome}`;
    const fotosValidas = fotos.filter(function(itemFoto) {
      return itemFoto && itemFoto.base64;
    });
    const subpasta = fotosValidas.length ? pastaRaiz.createFolder(nomeSubpasta) : null;
    let linkPastaDrive = "";
    if (subpasta) {
      compartilharComoLeitura(subpasta);
      linkPastaDrive = subpasta.getUrl();
    }
    const linksFotos = [];
    let fotosSalvas = 0;

    for (let i = 0; i < fotosValidas.length; i++) {
      const itemFoto = fotosValidas[i];

      let base64Limpo = itemFoto.base64;
      if (base64Limpo.indexOf(",") > -1) {
        base64Limpo = base64Limpo.split(",")[1];
      }

      const mimeType = itemFoto.mimeType || "image/jpeg";
      const extensao = mimeType.indexOf("png") > -1 ? "png" : "jpg";
      const indiceFormatado = String(i + 1).padStart(2, "0");
      const nomeArquivo = itemFoto.name || `foto_${indiceFormatado}.${extensao}`;
      const bytes = Utilities.base64Decode(base64Limpo);
      const blob = Utilities.newBlob(bytes, mimeType, nomeArquivo);
      const arquivo = subpasta.createFile(blob);

      compartilharComoLeitura(arquivo);
      linksFotos.push(arquivo.getUrl());
      fotosSalvas++;
    }

    const planilha = obterOuCriarPlanilha(pastaRaiz, NOME_PLANILHA);
    const aba = garantirAbaRegistros(planilha);
    const timestamp = Utilities.formatDate(new Date(), FUSO_HORARIO, "dd/MM/yyyy HH:mm:ss");
    const recordId = Utilities.getUuid();
    const deleteToken = gerarChaveExclusao();

    aba.appendRow([
      timestamp,
      dataExecucao,
      categoria,
      predioNome,
      endereco,
      fotosSalvas,
      linkPastaDrive,
      responsavel,
      observacoes,
      linksFotos.join("\n"),
      recordId,
      deleteToken
    ]);

    return responderJson({
      status: "success",
      message: fotosSalvas ? "Fotos enviadas e registradas com sucesso!" : "Execução registrada sem fotos.",
      categoria: categoria,
      predioNome: predioNome,
      dataExecucao: dataExecucao,
      fotosRecebidas: fotosSalvas,
      folderUrl: linkPastaDrive,
      folderName: nomeSubpasta,
      photoUrls: linksFotos,
      sheetUrl: planilha.getUrl(),
      timestamp: timestamp,
      recordId: recordId,
      deleteToken: deleteToken
    });

  } catch (error) {
    Logger.log("Erro no processamento doPost: " + error.toString());
    return responderJson({
      status: "error",
      message: error.message || error.toString()
    });
  }
}

/** Acrescenta fotos a uma execução existente ou materializa uma execução do histórico do Excel. */
function adicionarFotosARegistro(payload) {
  const fotos = (Array.isArray(payload.fotos) ? payload.fotos : []).filter(function(itemFoto) {
    return itemFoto && itemFoto.base64;
  });
  if (!fotos.length) throw new Error("Selecione pelo menos uma foto para anexar.");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const pastaRaiz = obterOuCriarPastaRaiz(NOME_PASTA_PRINCIPAL);
    const planilha = obterOuCriarPlanilha(pastaRaiz, NOME_PLANILHA);
    const aba = garantirAbaRegistros(planilha);
    const valores = aba.getDataRange().getDisplayValues();
    const recordIdRecebido = String(payload.recordId || "").trim();
    const predioNome = String(payload.predioNome || "Prédio Não Identificado").trim();
    const dataExecucao = String(payload.dataExecucao || Utilities.formatDate(new Date(), FUSO_HORARIO, "dd/MM/yyyy")).trim();
    const chavePredio = normalizarChave(predioNome);
    const chaveData = normalizarDataChave(dataExecucao);
    let numeroLinha = 0;

    for (let i = 1; i < valores.length; i++) {
      const idAtual = String(valores[i][10] || "").trim();
      const correspondeId = recordIdRecebido && idAtual === recordIdRecebido;
      const correspondeHistorico = normalizarChave(valores[i][3]) === chavePredio && normalizarDataChave(valores[i][1]) === chaveData;
      if (correspondeId || (!recordIdRecebido && correspondeHistorico)) {
        numeroLinha = i + 1;
        break;
      }
    }

    if (!numeroLinha) {
      aba.appendRow([
        Utilities.formatDate(new Date(), FUSO_HORARIO, "dd/MM/yyyy HH:mm:ss"),
        dataExecucao,
        payload.categoria || "Geral",
        predioNome,
        payload.endereco || "Endereço não informado",
        0,
        "",
        payload.responsavel || "Não informado",
        payload.observacoes || "",
        "",
        recordIdRecebido || Utilities.getUuid(),
        gerarChaveExclusao()
      ]);
      numeroLinha = aba.getLastRow();
    }

    const rangeLinha = aba.getRange(numeroLinha, 1, 1, CABECALHOS_REGISTROS.length);
    const linha = rangeLinha.getDisplayValues()[0];
    let recordId = String(linha[10] || recordIdRecebido || "").trim();
    let deleteToken = String(linha[11] || "").trim();
    if (!recordId) recordId = Utilities.getUuid();
    if (!deleteToken) deleteToken = gerarChaveExclusao();

    let pastaUrl = String(linha[6] || "").trim();
    let subpasta = null;
    const pastaId = extrairIdPasta(pastaUrl);
    if (pastaId) {
      try {
        subpasta = DriveApp.getFolderById(pastaId);
      } catch (errorPasta) {
        Logger.log("A pasta anterior não pôde ser aberta; uma nova será criada: " + errorPasta.toString());
      }
    }
    if (!subpasta) {
      const dataFormatadaPasta = dataExecucao.replace(/\//g, "-").replace(/\./g, "-");
      subpasta = pastaRaiz.createFolder(`[${dataFormatadaPasta}] ${predioNome}`);
      compartilharComoLeitura(subpasta);
      pastaUrl = subpasta.getUrl();
    }

    const fotosExistentes = obterFotosDaPasta(pastaUrl);
    const quantidadeExistente = Math.max(Number(linha[5]) || 0, fotosExistentes.length);
    const vagas = Math.max(0, 20 - quantidadeExistente);
    if (!vagas) throw new Error("Esta execução já atingiu o limite de 20 fotos.");

    const linksExistentes = String(linha[9] || "").split(/\s*\n\s*/).filter(Boolean);
    const linksNovos = [];
    const fotosParaSalvar = fotos.slice(0, vagas);

    for (let i = 0; i < fotosParaSalvar.length; i++) {
      const itemFoto = fotosParaSalvar[i];
      let base64Limpo = itemFoto.base64;
      if (base64Limpo.indexOf(",") > -1) base64Limpo = base64Limpo.split(",")[1];

      const mimeType = itemFoto.mimeType || "image/jpeg";
      const extensao = mimeType.indexOf("png") > -1 ? "png" : "jpg";
      const indice = quantidadeExistente + i + 1;
      const nomeArquivo = itemFoto.name || `foto_${String(indice).padStart(2, "0")}.${extensao}`;
      const arquivo = subpasta.createFile(Utilities.newBlob(Utilities.base64Decode(base64Limpo), mimeType, nomeArquivo));
      compartilharComoLeitura(arquivo);
      linksNovos.push(arquivo.getUrl());
    }

    linha[5] = quantidadeExistente + linksNovos.length;
    linha[6] = pastaUrl;
    linha[9] = linksExistentes.concat(linksNovos).join("\n");
    linha[10] = recordId;
    linha[11] = deleteToken;
    rangeLinha.setValues([linha]);
    SpreadsheetApp.flush();

    return {
      status: "success",
      message: linksNovos.length + (linksNovos.length === 1 ? " foto anexada com sucesso." : " fotos anexadas com sucesso."),
      recordId: recordId,
      deleteToken: deleteToken,
      fotosAdicionadas: linksNovos.length,
      fotosRecebidas: Number(linha[5]) || linksNovos.length,
      folderUrl: pastaUrl,
      photoUrls: linksNovos,
      sheetUrl: planilha.getUrl()
    };
  } finally {
    lock.releaseLock();
  }
}

/** Exclui uma execução somente quando a chave privada do navegador confere. */
function excluirRegistro(payload) {
  const recordId = String(payload.recordId || "").trim();
  const deleteToken = String(payload.deleteToken || "").trim();
  if (!recordId || !deleteToken) {
    throw new Error("Identificação ou chave de exclusão ausente.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const pastaRaiz = obterOuCriarPastaRaiz(NOME_PASTA_PRINCIPAL);
    const arquivoPlanilha = pastaRaiz.getFilesByName(NOME_PLANILHA);
    if (!arquivoPlanilha.hasNext()) throw new Error("Planilha de registros não encontrada.");

    const planilha = SpreadsheetApp.openById(arquivoPlanilha.next().getId());
    const aba = garantirAbaRegistros(planilha);
    const valores = aba.getDataRange().getDisplayValues();
    let indiceLinha = -1;

    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][10] || "") === recordId) {
        indiceLinha = i;
        break;
      }
    }

    if (indiceLinha < 0 || String(valores[indiceLinha][11] || "") !== deleteToken) {
      throw new Error("Registro não encontrado ou exclusão não autorizada.");
    }

    const pastaUrl = valores[indiceLinha][6] || "";
    const pastaId = extrairIdPasta(pastaUrl);
    if (pastaId) {
      try {
        DriveApp.getFolderById(pastaId).setTrashed(true);
      } catch (errorPasta) {
        Logger.log("A linha será excluída, mas a pasta não pôde ser movida para a lixeira: " + errorPasta.toString());
      }
    }

    aba.deleteRow(indiceLinha + 1);
    SpreadsheetApp.flush();

    return {
      status: "success",
      message: "Registro e pasta de fotos excluídos com sucesso.",
      recordId: recordId
    };
  } finally {
    lock.releaseLock();
  }
}

function gerarChaveExclusao() {
  return Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
}

/** Monta todos os registros do período solicitado para a tela de relatório. */
function obterRelatorio(parametros) {
  try {
    const pastaRaiz = obterOuCriarPastaRaiz(NOME_PASTA_PRINCIPAL);
    const arquivoPlanilha = pastaRaiz.getFilesByName(NOME_PLANILHA);

    if (!arquivoPlanilha.hasNext()) {
      return {
        status: "success",
        acao: "relatorio",
        totalExecucoes: 0,
        totalFotos: 0,
        registros: [],
        mensagem: "Ainda não existem registros na planilha."
      };
    }

    const arquivo = arquivoPlanilha.next();
    const planilha = SpreadsheetApp.openById(arquivo.getId());
    const aba = garantirAbaRegistros(planilha);
    const valores = aba.getDataRange().getDisplayValues();
    const inicio = parametros.inicio ? converterData(parametros.inicio) : null;
    const fim = parametros.fim ? converterData(parametros.fim) : null;
    if (fim) fim.setHours(23, 59, 59, 999);
    const categoriaFiltro = String(parametros.categoria || "").trim().toLowerCase();
    const registros = [];

    for (let i = 1; i < valores.length; i++) {
      const linha = valores[i];
      if (!linha || linha.length < 2 || !linha[1]) continue;

      const dataExecucao = converterData(linha[1]);
      if (inicio && (!dataExecucao || dataExecucao < inicio)) continue;
      if (fim && (!dataExecucao || dataExecucao > fim)) continue;
      if (categoriaFiltro && String(linha[2] || "").trim().toLowerCase() !== categoriaFiltro) continue;

      const pastaUrl = linha[6] || "";
      const fotos = obterFotosDaPasta(pastaUrl);
      const linksDaPlanilha = String(linha[9] || "").split(/\s*\n\s*/).filter(Boolean);
      const fotosCompletas = fotos.length ? fotos : linksDaPlanilha.map(function(url, index) {
        return {
          nome: "Foto " + String(index + 1).padStart(2, "0"),
          url: url,
          imageUrl: url
        };
      });

      registros.push({
        timestamp: linha[0] || "",
        dataExecucao: linha[1] || "",
        dataIso: dataExecucao ? Utilities.formatDate(dataExecucao, FUSO_HORARIO, "yyyy-MM-dd") : "",
        categoria: linha[2] || "Geral",
        predioNome: linha[3] || "Prédio não informado",
        endereco: linha[4] || "Endereço não informado",
        fotosRecebidas: Number(linha[5]) || fotosCompletas.length,
        folderUrl: pastaUrl,
        responsavel: linha[7] || "Não informado",
        observacoes: linha[8] || "",
        recordId: linha[10] || "",
        fotos: fotosCompletas
      });
    }

    registros.sort(function(a, b) {
      return String(b.dataIso || b.dataExecucao).localeCompare(String(a.dataIso || a.dataExecucao));
    });

    let totalFotos = 0;
    registros.forEach(function(registro) {
      totalFotos += registro.fotos.length || registro.fotosRecebidas || 0;
    });

    return {
      status: "success",
      acao: "relatorio",
      inicio: parametros.inicio || "",
      fim: parametros.fim || "",
      categoria: parametros.categoria || "",
      totalExecucoes: registros.length,
      totalFotos: totalFotos,
      registros: registros,
      sheetUrl: planilha.getUrl()
    };
  } catch (error) {
    Logger.log("Erro ao montar relatório: " + error.toString());
    return {
      status: "error",
      message: error.message || error.toString()
    };
  }
}

/** Retorna imagens e links dos arquivos dentro da pasta da execução. */
function obterFotosDaPasta(pastaUrl) {
  const pastaId = extrairIdPasta(pastaUrl);
  if (!pastaId) return [];

  try {
    const pasta = DriveApp.getFolderById(pastaId);
    const arquivos = pasta.getFiles();
    const fotos = [];

    while (arquivos.hasNext()) {
      const arquivo = arquivos.next();
      if (String(arquivo.getMimeType()).indexOf("image/") !== 0) continue;
      const id = arquivo.getId();
      fotos.push({
        nome: arquivo.getName(),
        url: arquivo.getUrl(),
        imageUrl: "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w1400"
      });
    }

    fotos.sort(function(a, b) {
      return a.nome.localeCompare(b.nome, "pt-BR", {numeric: true});
    });
    return fotos;
  } catch (error) {
    Logger.log("Não foi possível listar fotos da pasta: " + error.toString());
    return [];
  }
}

function extrairIdPasta(url) {
  const texto = String(url || "");
  const correspondencia = texto.match(/folders\/([a-zA-Z0-9_-]+)/);
  return correspondencia ? correspondencia[1] : "";
}

function converterData(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) return new Date(valor.getTime());
  const texto = String(valor || "").trim();
  if (!texto) return null;

  let partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (partes) return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));

  partes = texto.match(/^(\d{1,2})[\\/.\-](\d{1,2})[\\/.\-](\d{4})$/);
  if (!partes) return null;

  const data = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]));
  return isNaN(data.getTime()) ? null : data;
}

function normalizarChave(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizarDataChave(valor) {
  const data = converterData(valor);
  return data ? Utilities.formatDate(data, FUSO_HORARIO, "yyyy-MM-dd") : String(valor || "").trim();
}

function responderJson(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function compartilharComoLeitura(arquivoOuPasta) {
  try {
    arquivoOuPasta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    Logger.log("Aviso ao definir compartilhamento: " + error.toString());
  }
}

function obterOuCriarPastaRaiz(nomePasta) {
  const pastas = DriveApp.getFoldersByName(nomePasta);
  return pastas.hasNext() ? pastas.next() : DriveApp.createFolder(nomePasta);
}

function obterOuCriarPlanilha(pastaDestino, nomePlanilha) {
  const arquivos = pastaDestino.getFilesByName(nomePlanilha);
  if (arquivos.hasNext()) {
    const planilhaExistente = SpreadsheetApp.openById(arquivos.next().getId());
    garantirAbaRegistros(planilhaExistente);
    return planilhaExistente;
  }

  const novaPlanilha = SpreadsheetApp.create(nomePlanilha);
  const aba = novaPlanilha.getActiveSheet();
  aba.setName(NOME_ABA_REGISTROS);
  configurarCabecalho(aba);

  const arquivoSpreadsheet = DriveApp.getFileById(novaPlanilha.getId());
  pastaDestino.addFile(arquivoSpreadsheet);
  DriveApp.getRootFolder().removeFile(arquivoSpreadsheet);
  return novaPlanilha;
}

function garantirAbaRegistros(planilha) {
  let aba = planilha.getSheetByName(NOME_ABA_REGISTROS);
  if (!aba) aba = planilha.getActiveSheet();

  const primeiraLinha = aba.getRange(1, 1, 1, CABECALHOS_REGISTROS.length).getDisplayValues()[0];
  let precisaAtualizar = false;
  for (let i = 0; i < CABECALHOS_REGISTROS.length; i++) {
    if (primeiraLinha[i] !== CABECALHOS_REGISTROS[i]) {
      precisaAtualizar = true;
      break;
    }
  }
  if (precisaAtualizar) configurarCabecalho(aba);
  garantirIdentificadoresRegistros(aba);
  return aba;
}

function garantirIdentificadoresRegistros(aba) {
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return;

  const range = aba.getRange(2, 11, ultimaLinha - 1, 2);
  const valores = range.getValues();
  let alterou = false;

  for (let i = 0; i < valores.length; i++) {
    if (!String(valores[i][0] || "").trim()) {
      valores[i][0] = Utilities.getUuid();
      alterou = true;
    }
    if (!String(valores[i][1] || "").trim()) {
      valores[i][1] = gerarChaveExclusao();
      alterou = true;
    }
  }

  if (alterou) range.setValues(valores);
}

function configurarCabecalho(aba) {
  aba.getRange(1, 1, 1, CABECALHOS_REGISTROS.length).setValues([CABECALHOS_REGISTROS]);
  const rangeCabecalho = aba.getRange(1, 1, 1, CABECALHOS_REGISTROS.length);
  rangeCabecalho.setBackground("#005da4");
  rangeCabecalho.setFontColor("#ffffff");
  rangeCabecalho.setFontWeight("bold");
  rangeCabecalho.setHorizontalAlignment("center");
  rangeCabecalho.setWrap(true);
  aba.setFrozenRows(1);
  aba.setColumnWidth(1, 150);
  aba.setColumnWidth(2, 125);
  aba.setColumnWidth(3, 145);
  aba.setColumnWidth(4, 260);
  aba.setColumnWidth(5, 300);
  aba.setColumnWidth(6, 85);
  aba.setColumnWidth(7, 320);
  aba.setColumnWidth(8, 160);
  aba.setColumnWidth(9, 300);
  aba.setColumnWidth(10, 420);
  aba.setColumnWidth(11, 230);
  aba.setColumnWidth(12, 230);
  aba.hideColumns(12);
}
