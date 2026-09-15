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

  return responderJson({
    status: "ok",
    app: "SELIM Prédios Públicos API",
    versao: "1.2",
    dataHoraServidor: new Date().toISOString(),
    mensagem: "O Web App do Google Apps Script está ativo e pronto para receber fotos e relatórios."
  });
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

    const categoria = payload.categoria || "Geral";
    const predioNome = payload.predioNome || "Prédio Não Identificado";
    const endereco = payload.endereco || "Endereço não informado";
    const dataExecucao = payload.dataExecucao || Utilities.formatDate(new Date(), FUSO_HORARIO, "dd/MM/yyyy");
    const responsavel = payload.responsavel || "Não informado";
    const observacoes = payload.observacoes || "";
    const fotos = payload.fotos || [];

    const pastaRaiz = obterOuCriarPastaRaiz(NOME_PASTA_PRINCIPAL);
    const dataFormatadaPasta = dataExecucao.replace(/\//g, "-").replace(/\./g, "-");
    const nomeSubpasta = `[${dataFormatadaPasta}] ${predioNome}`;
    const subpasta = pastaRaiz.createFolder(nomeSubpasta);

    compartilharComoLeitura(subpasta);
    const linkPastaDrive = subpasta.getUrl();
    const linksFotos = [];
    let fotosSalvas = 0;

    for (let i = 0; i < fotos.length; i++) {
      const itemFoto = fotos[i];
      if (!itemFoto || !itemFoto.base64) continue;

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
      message: "Fotos enviadas e registradas com sucesso!",
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
  return aba;
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
