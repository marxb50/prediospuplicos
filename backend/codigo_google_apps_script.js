/**
 * =========================================================================
 * SELIM - COORDENADORIA DE LIMPEZA URBANA DE PARNAMIRIM
 * SISTEMA DE REGISTRO FOTOGRÁFICO DE PRÉDIOS PÚBLICOS
 * Google Apps Script Web App (Backend Serverless Gratuito)
 * =========================================================================
 * 
 * Este script deve ser copiado e colado no Google Apps Script (script.google.com).
 * Ele executa as seguintes funções automaticamente:
 * 1. Localiza ou cria a pasta principal no Google Drive: "fotos selim predios publicos"
 * 2. Para cada envio do celular, cria uma subpasta exclusiva (ex: "[15/09/2026] UBS BELA PARNAMIRIM")
 * 3. Salva todas as fotos anexadas (até 20 ou mais) dentro desta subpasta
 * 4. Configura o link de visualização da pasta
 * 5. Localiza ou cria a Planilha Google: "Controle de Fotos - Prédios Públicos SELIM"
 * 6. Registra uma nova linha com os dados da vistoria e o LINK ÚNICO da pasta de fotos
 * 7. Retorna a confirmação e o link direto para a tela do celular do usuário.
 */

// Nome exato da pasta principal solicitado pelo usuário
const NOME_PASTA_PRINCIPAL = "fotos selim predios publicos";
const NOME_PLANILHA = "Controle de Fotos - Prédios Públicos SELIM";

/**
 * Responde a requisições GET (Healthcheck para verificar se a API está online)
 */
function doGet(e) {
  const result = {
    status: "ok",
    app: "SELIM Prédios Públicos API",
    versao: "1.0",
    dataHoraServidor: new Date().toISOString(),
    mensagem: "O Web App do Google Apps Script está ativo e pronto para receber fotos."
  };
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Responde a requisições POST vindas do aplicativo mobile
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Nenhum dado recebido na requisição POST.");
    }

    const payload = JSON.parse(e.postData.contents);
    const categoria = payload.categoria || "Geral";
    const predioNome = payload.predioNome || "Prédio Não Identificado";
    const endereco = payload.endereco || "Endereço não informado";
    const dataExecucao = payload.dataExecucao || Utilities.formatDate(new Date(), "GMT-03:00", "dd/MM/yyyy");
    const responsavel = payload.responsavel || "Não informado";
    const observacoes = payload.observacoes || "";
    const fotos = payload.fotos || []; // Array de { name, mimeType, base64 }

    // 1. Obter ou criar a pasta raiz "fotos selim predios publicos"
    const pastaRaiz = obterOuCriarPastaRaiz(NOME_PASTA_PRINCIPAL);

    // 2. Criar subpasta para esta execução específica (Ex: [15-09-2026] UBS BELA PARNAMIRIM)
    const dataFormatadaPasta = dataExecucao.replace(/\//g, "-").replace(/\./g, "-");
    const nomeSubpasta = `[${dataFormatadaPasta}] ${predioNome}`;
    const subpasta = pastaRaiz.createFolder(nomeSubpasta);

    // Tornar a pasta visível para quem tiver o link (opcional, facilita abrir no celular/computador)
    try {
      subpasta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {
      Logger.log("Aviso ao definir permissão de compartilhamento: " + permErr.message);
    }

    const linkPastaDrive = subpasta.getUrl();

    // 3. Salvar cada uma das fotos enviadas dentro da subpasta
    let fotosSalvas = 0;
    for (let i = 0; i < fotos.length; i++) {
      const itemFoto = fotos[i];
      if (!itemFoto || !itemFoto.base64) continue;

      let base64Limpo = itemFoto.base64;
      // Remover prefixo de DataURL se existir (ex: data:image/jpeg;base64,...)
      if (base64Limpo.indexOf(",") > -1) {
        base64Limpo = base64Limpo.split(",")[1];
      }

      const mimeType = itemFoto.mimeType || "image/jpeg";
      const extensao = mimeType.indexOf("png") > -1 ? "png" : "jpg";
      const indiceFormatado = String(i + 1).padStart(2, "0");
      const nomeArquivo = itemFoto.name || `foto_${indiceFormatado}.${extensao}`;

      const bytes = Utilities.base64Decode(base64Limpo);
      const blob = Utilities.newBlob(bytes, mimeType, nomeArquivo);
      subpasta.createFile(blob);
      fotosSalvas++;
    }

    // 4. Registrar linha na Planilha Google Sheets
    const planilha = obterOuCriarPlanilha(pastaRaiz, NOME_PLANILHA);
    const aba = planilha.getActiveSheet();
    const timestamp = Utilities.formatDate(new Date(), "GMT-03:00", "dd/MM/yyyy HH:mm:ss");

    // Adiciona nova linha na planilha com o link que abre TODAS as fotos
    aba.appendRow([
      timestamp,
      dataExecucao,
      categoria,
      predioNome,
      endereco,
      fotosSalvas,
      linkPastaDrive,
      responsavel,
      observacoes
    ]);

    // Retorna resposta de sucesso para o aplicativo
    const resposta = {
      status: "success",
      message: "Fotos enviadas e registradas com sucesso!",
      categoria: categoria,
      predioNome: predioNome,
      dataExecucao: dataExecucao,
      fotosRecebidas: fotosSalvas,
      folderUrl: linkPastaDrive,
      folderName: nomeSubpasta,
      timestamp: timestamp
    };

    return ContentService.createTextOutput(JSON.stringify(resposta))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Erro no processamento doPost: " + error.toString());
    const erroResposta = {
      status: "error",
      message: error.message || error.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(erroResposta))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Encontra a pasta raiz no Drive ou cria se ainda não existir
 */
function obterOuCriarPastaRaiz(nomePasta) {
  const pastas = DriveApp.getFoldersByName(nomePasta);
  if (pastas.hasNext()) {
    return pastas.next();
  }
  return DriveApp.createFolder(nomePasta);
}

/**
 * Encontra a planilha no Drive ou cria uma nova com cabeçalhos bonitos
 */
function obterOuCriarPlanilha(pastaDestino, nomePlanilha) {
  const arquivos = pastaDestino.getFilesByName(nomePlanilha);
  if (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    return SpreadsheetApp.openById(arquivo.getId());
  }

  // Cria nova planilha
  const novaPlanilha = SpreadsheetApp.create(nomePlanilha);
  const aba = novaPlanilha.getActiveSheet();
  aba.setName("Registros SELIM");

  // Cabeçalhos oficiais
  const cabecalhos = [
    "Carimbo de Data/Hora",
    "Data da Execução",
    "Categoria",
    "Prédio Público",
    "Endereço",
    "Qtd Fotos",
    "Link da Pasta no Google Drive (Todas as Fotos)",
    "Responsável",
    "Observações"
  ];

  aba.appendRow(cabecalhos);

  // Estilização dos cabeçalhos (Azul SELIM, texto branco e negrito)
  const rangeCabecalho = aba.getRange(1, 1, 1, cabecalhos.length);
  rangeCabecalho.setBackground("#005da4");
  rangeCabecalho.setFontColor("#ffffff");
  rangeCabecalho.setFontWeight("bold");
  rangeCabecalho.setHorizontalAlignment("center");
  aba.setFrozenRows(1);

  // Mover o arquivo criado para dentro da pasta raiz
  const arquivoSpreadsheet = DriveApp.getFileById(novaPlanilha.getId());
  pastaDestino.addFile(arquivoSpreadsheet);
  DriveApp.getRootFolder().removeFile(arquivoSpreadsheet);

  return novaPlanilha;
}
