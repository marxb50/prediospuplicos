/**
 * =========================================================================
 * SELIM - COORDENADORIA DE LIMPEZA URBANA DE PARNAMIRIM
 * APLICATIVO MOBILE: REGISTRO FOTOGRÁFICO DE PRÉDIOS PÚBLICOS
 * Lógica principal da aplicação client-side (SPA)
 * =========================================================================
 */

// URL padrão do Google Apps Script. Depois de publicar o backend, o endereço
// real fica gravado aqui para que todos os celulares já abram conectados.
const DEFAULT_GAS_URL = "";

document.addEventListener('DOMContentLoaded', () => {
  // Estado da Aplicação
  const state = {
    currentStep: 1,
    selectedCategoryKey: null,
    selectedCategoryObj: null,
    selectedPlace: null,
    attachedPhotos: [], // Array de { id, name, base64, mimeType, dataUrl }
    maxPhotos: 20,
    scriptUrl: localStorage.getItem('selim_gas_url') || DEFAULT_GAS_URL || '',
    isSubmitting: false
  };

  // Elementos DOM principais
  const screens = {
    1: document.getElementById('screen1'),
    2: document.getElementById('screen2'),
    3: document.getElementById('screen3'),
    4: document.getElementById('screen4')
  };

  const stepIndicators = document.querySelectorAll('.step-indicator');
  const stepLines = {
    1: document.getElementById('line1'),
    2: document.getElementById('line2')
  };

  // Elementos Tela 1
  const categoriesContainer = document.getElementById('categoriesContainer');

  // Elementos Tela 2
  const currentCategoryBadge = document.getElementById('currentCategoryBadge');
  const inputSearchPredio = document.getElementById('inputSearchPredio');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const placesCountText = document.getElementById('placesCountText');
  const placesContainer = document.getElementById('placesContainer');
  const btnCustomPlace = document.getElementById('btnCustomPlace');
  const btnBackToScreen1 = document.getElementById('btnBackToScreen1');

  // Elementos Tela 3
  const btnBackToScreen2 = document.getElementById('btnBackToScreen2');
  const selectedBuildingIcon = document.getElementById('selectedBuildingIcon');
  const selectedBuildingCat = document.getElementById('selectedBuildingCat');
  const selectedBuildingName = document.getElementById('selectedBuildingName');
  const selectedBuildingAddress = document.getElementById('selectedBuildingAddress');
  const inputDataExecucao = document.getElementById('inputDataExecucao');
  const inputResponsavel = document.getElementById('inputResponsavel');
  const inputObservacoes = document.getElementById('inputObservacoes');
  
  const btnTriggerCamera = document.getElementById('btnTriggerCamera');
  const btnTriggerGallery = document.getElementById('btnTriggerGallery');
  const cameraInput = document.getElementById('cameraInput');
  const galleryInput = document.getElementById('galleryInput');
  const photosGrid = document.getElementById('photosGrid');
  const photosEmptyState = document.getElementById('photosEmptyState');
  const photoCountBadge = document.getElementById('photoCountBadge');
  const btnSubmitForm = document.getElementById('btnSubmitForm');

  // Elementos Tela 4 (Sucesso)
  const successPredioNome = document.getElementById('successPredioNome');
  const successDataExecucao = document.getElementById('successDataExecucao');
  const successFotosCount = document.getElementById('successFotosCount');
  const btnOpenDriveFolder = document.getElementById('btnOpenDriveFolder');
  const btnOpenSheet = document.getElementById('btnOpenSheet');
  const btnNewSubmission = document.getElementById('btnNewSubmission');

  // Modais e Overlays
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const inputScriptUrl = document.getElementById('inputScriptUrl');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  const photoPreviewModal = document.getElementById('photoPreviewModal');
  const btnClosePhotoViewer = document.getElementById('btnClosePhotoViewer');
  const viewerImage = document.getElementById('viewerImage');

  const uploadOverlay = document.getElementById('uploadOverlay');
  const uploadStatusTitle = document.getElementById('uploadStatusTitle');
  const uploadStatusSubtitle = document.getElementById('uploadStatusSubtitle');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const uploadProgressPercent = document.getElementById('uploadProgressPercent');

  // =========================================================================
  // 1. INICIALIZAÇÃO
  // =========================================================================
  function init() {
    // Definir data padrão de hoje no input de data (formato YYYY-MM-DD)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    inputDataExecucao.value = `${year}-${month}-${day}`;

    // Renderizar categorias da Tela 1
    renderCategories();

    // Carregar configurações
    if (state.scriptUrl) {
      inputScriptUrl.value = state.scriptUrl;
      testScriptConnection(state.scriptUrl);
    }

    // Configurar Ouvintes de Eventos
    setupEventListeners();
  }

  // =========================================================================
  // 2. NAVEGAÇÃO ENTRE TELAS
  // =========================================================================
  function goToStep(step) {
    state.currentStep = step;

    // Alternar visibilidade das telas
    Object.keys(screens).forEach(key => {
      screens[key].classList.toggle('active', parseInt(key) === step);
    });

    // Atualizar indicador visual de passos
    stepIndicators.forEach(ind => {
      const stepNum = parseInt(ind.dataset.step);
      ind.classList.toggle('active', stepNum === step);
      ind.classList.toggle('completed', stepNum < step);
    });

    if (stepLines[1]) stepLines[1].classList.toggle('active', step >= 2);
    if (stepLines[2]) stepLines[2].classList.toggle('active', step >= 3);

    // Scroll suave para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =========================================================================
  // 3. TELA 1: CATEGORIAS
  // =========================================================================
  function renderCategories() {
    categoriesContainer.innerHTML = '';

    if (typeof PREDIOS_DATA === 'undefined') {
      categoriesContainer.innerHTML = '<p class="error-msg">Erro: Arquivo de dados de prédios não encontrado.</p>';
      return;
    }

    Object.keys(PREDIOS_DATA).forEach(catKey => {
      const cat = PREDIOS_DATA[catKey];
      const card = document.createElement('div');
      card.className = 'category-card';
      card.innerHTML = `
        <div class="cat-icon-badge">${cat.icone}</div>
        <div class="cat-title">${cat.categoria_nome}</div>
        <div class="cat-count">
          <span class="cat-count-num">${cat.total}</span> locais cadastrados
        </div>
      `;

      card.addEventListener('click', () => {
        selectCategory(catKey);
      });

      categoriesContainer.appendChild(card);
    });
  }

  function selectCategory(catKey) {
    state.selectedCategoryKey = catKey;
    state.selectedCategoryObj = PREDIOS_DATA[catKey];

    // Atualizar cabeçalho da tela 2
    currentCategoryBadge.textContent = `${state.selectedCategoryObj.icone} ${state.selectedCategoryObj.categoria_nome}`;

    // Limpar busca e listar todos os locais da categoria
    inputSearchPredio.value = '';
    btnClearSearch.classList.add('hidden');
    renderPlacesList(state.selectedCategoryObj.itens);

    goToStep(2);
  }

  // =========================================================================
  // 4. TELA 2: LUGARES E FILTROS DE BUSCA
  // =========================================================================
  function normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function renderPlacesList(items) {
    placesContainer.innerHTML = '';
    placesCountText.textContent = `${items.length} locais encontrados`;

    if (items.length === 0) {
      placesContainer.innerHTML = `
        <div class="photos-empty-state">
          <span class="empty-icon">🔍</span>
          <p>Nenhum local encontrado para esta busca.</p>
          <small>Verifique a digitação ou adicione manualmente abaixo.</small>
        </div>
      `;
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'place-item-card';
      
      const badgeText = item.num ? item.num : String(index + 1);

      card.innerHTML = `
        <div class="place-badge-num">${badgeText}</div>
        <div class="place-info">
          <h4 class="place-name">${item.nome}</h4>
          <p class="place-address">📍 ${item.endereco || 'Endereço em atualização'}</p>
        </div>
        <div class="place-arrow">›</div>
      `;

      card.addEventListener('click', () => {
        selectPlace(item);
      });

      placesContainer.appendChild(card);
    });
  }

  function filterPlaces() {
    if (!state.selectedCategoryObj) return;

    const query = normalizeText(inputSearchPredio.value.trim());
    btnClearSearch.classList.toggle('hidden', query.length === 0);

    if (!query) {
      renderPlacesList(state.selectedCategoryObj.itens);
      return;
    }

    const filtered = state.selectedCategoryObj.itens.filter(item => {
      const matchName = normalizeText(item.nome).includes(query);
      const matchAddress = normalizeText(item.endereco).includes(query);
      const matchNum = normalizeText(item.num).includes(query);
      return matchName || matchAddress || matchNum;
    });

    renderPlacesList(filtered);
  }

  function selectPlace(place) {
    state.selectedPlace = place;

    // Atualizar resumo na Tela 3
    selectedBuildingIcon.textContent = state.selectedCategoryObj ? state.selectedCategoryObj.icone : '🏛️';
    selectedBuildingCat.textContent = state.selectedCategoryObj ? state.selectedCategoryObj.categoria_nome : 'Prédio Público';
    selectedBuildingName.textContent = place.nome;
    selectedBuildingAddress.textContent = place.endereco || 'Endereço não informado';

    goToStep(3);
  }

  function handleCustomPlace() {
    const customName = prompt('Digite o nome do Prédio Público / Local:');
    if (!customName || !customName.trim()) return;

    const customAddress = prompt('Digite o endereço ou bairro (opcional):') || 'Endereço não informado';

    const customObj = {
      num: 'Novo',
      nome: customName.trim().toUpperCase(),
      endereco: customAddress.trim(),
      subcategoria: 'Cadastrado Manualmente'
    };

    selectPlace(customObj);
  }

  // =========================================================================
  // 5. TELA 3: MANIPULAÇÃO DE FOTOS E COMPRESSÃO NO CELULAR
  // =========================================================================
  
  // Acionamento de câmera e galeria
  btnTriggerCamera.addEventListener('click', () => {
    cameraInput.click();
  });

  btnTriggerGallery.addEventListener('click', () => {
    galleryInput.click();
  });

  cameraInput.addEventListener('change', (e) => {
    handleFilesSelected(e.target.files);
    cameraInput.value = ''; // Limpa para permitir tirar outra foto
  });

  galleryInput.addEventListener('change', (e) => {
    handleFilesSelected(e.target.files);
    galleryInput.value = ''; // Limpa para permitir nova seleção
  });

  async function handleFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const availableSlots = state.maxPhotos - state.attachedPhotos.length;

    if (availableSlots <= 0) {
      alert(`Você já atingiu o limite máximo de ${state.maxPhotos} fotos.`);
      return;
    }

    if (filesArray.length > availableSlots) {
      alert(`Você selecionou ${filesArray.length} fotos, mas só há espaço para mais ${availableSlots}. Apenas as primeiras ${availableSlots} serão adicionadas.`);
    }

    const toProcess = filesArray.slice(0, availableSlots);

    // Exibe overlay de compressão rápida
    showUploadProgress('Processando Fotos...', 'Otimizando imagens no celular', 20);

    for (let i = 0; i < toProcess.length; i++) {
      const file = toProcess[i];
      try {
        const compressedData = await compressImage(file, 1600, 0.82);
        state.attachedPhotos.push({
          id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: file.name || `foto_${state.attachedPhotos.length + 1}.jpg`,
          dataUrl: compressedData.dataUrl,
          base64: compressedData.base64,
          mimeType: compressedData.mimeType
        });
      } catch (err) {
        console.error('Erro ao comprimir foto:', err);
      }
      
      const percent = Math.round(20 + ((i + 1) / toProcess.length) * 80);
      updateUploadPercent(percent);
    }

    hideUploadProgress();
    renderPhotosGrid();
  }

  /**
   * Comprime e redimensiona imagem no próprio navegador usando HTML5 Canvas
   * Reduz fotos de 8MB para ~200KB-300KB com excelente nitidez visual
   */
  function compressImage(file, maxDimension = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Redimensionar proporcionalmente se exceder a dimensão máxima
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          // Desenha imagem redimensionada
          ctx.drawImage(img, 0, 0, width, height);

          // Converte para JPEG com compressão
          const mimeType = 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, quality);
          const base64 = dataUrl.split(',')[1];

          resolve({
            dataUrl: dataUrl,
            base64: base64,
            mimeType: mimeType
          });
        };
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderPhotosGrid() {
    photosGrid.innerHTML = '';
    const count = state.attachedPhotos.length;

    // Atualizar badge de contagem
    photoCountBadge.textContent = `${count} / ${state.maxPhotos}`;
    photoCountBadge.style.background = count >= state.maxPhotos ? '#fef3c7' : '';
    photoCountBadge.style.color = count >= state.maxPhotos ? '#b45309' : '';

    // Habilitar ou desabilitar botão de envio
    btnSubmitForm.disabled = (count === 0);

    if (count === 0) {
      photosGrid.appendChild(photosEmptyState);
      return;
    }

    state.attachedPhotos.forEach((photo, index) => {
      const wrap = document.createElement('div');
      wrap.className = 'photo-thumb-wrap';
      
      wrap.innerHTML = `
        <img src="${photo.dataUrl}" alt="Foto ${index + 1}">
        <span class="photo-index-tag">#${index + 1}</span>
        <button type="button" class="btn-remove-photo" title="Remover foto" data-id="${photo.id}">✕</button>
      `;

      // Clique na imagem para ampliar
      wrap.querySelector('img').addEventListener('click', () => {
        openPhotoViewer(photo.dataUrl);
      });

      // Clique para remover
      wrap.querySelector('.btn-remove-photo').addEventListener('click', (e) => {
        e.stopPropagation();
        removePhoto(photo.id);
      });

      photosGrid.appendChild(wrap);
    });
  }

  function removePhoto(id) {
    state.attachedPhotos = state.attachedPhotos.filter(p => p.id !== id);
    renderPhotosGrid();
  }

  function openPhotoViewer(url) {
    viewerImage.src = url;
    photoPreviewModal.classList.remove('hidden');
  }

  btnClosePhotoViewer.addEventListener('click', () => {
    photoPreviewModal.classList.add('hidden');
    viewerImage.src = '';
  });

  // =========================================================================
  // 6. ENVIO PARA O GOOGLE DRIVE E PLANILHA GOOGLE
  // =========================================================================
  btnSubmitForm.addEventListener('click', async () => {
    if (state.isSubmitting) return;

    if (state.attachedPhotos.length === 0) {
      alert('Por favor, anexe pelo menos 1 foto antes de enviar.');
      return;
    }

    const dataExecFormatada = formatarDataBR(inputDataExecucao.value);
    const responsavel = inputResponsavel.value.trim();
    const observacoes = inputObservacoes.value.trim();

    // Sem uma URL real, não fingir que o registro foi salvo.
    if (!state.scriptUrl) {
      settingsModal.classList.remove('hidden');
      setConnectionStatus('error', 'Conexão ainda não configurada');
      alert('Configure a conexão com o Google Drive na engrenagem antes de enviar.');
      return;
    }

    state.isSubmitting = true;
    btnSubmitForm.disabled = true;

    // Exibir tela de progresso de upload
    showUploadProgress(
      'Enviando Fotos...',
      `Gravando ${state.attachedPhotos.length} fotos na pasta 'fotos selim predios publicos'`,
      10
    );

    try {
      // ENVIO REAL PARA O GOOGLE APPS SCRIPT
      updateUploadPercent(30);

      const payload = {
        categoria: state.selectedCategoryObj ? state.selectedCategoryObj.categoria_nome : 'Prédio Público',
        predioNome: state.selectedPlace.nome,
        endereco: state.selectedPlace.endereco,
        dataExecucao: dataExecFormatada,
        responsavel: responsavel,
        observacoes: observacoes,
        fotos: state.attachedPhotos.map((p, idx) => ({
          name: `${state.selectedPlace.nome.replace(/[^a-zA-Z0-9]/g, '_')}_foto_${idx + 1}.jpg`,
          mimeType: p.mimeType,
          base64: p.base64
        }))
      };

      updateUploadPercent(60);

      const response = await fetch(state.scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      updateUploadPercent(90);

      const result = await response.json();

      if (result.status !== 'success') {
        throw new Error(result.message || 'Erro desconhecido retornado pelo servidor Google.');
      }

      updateUploadPercent(100);
      setTimeout(() => {
        finishSuccess({
          folderUrl: result.folderUrl,
          sheetUrl: result.sheetUrl,
          predioNome: state.selectedPlace.nome,
          dataExecucao: dataExecFormatada,
          fotosCount: result.fotosRecebidas || state.attachedPhotos.length
        });
      }, 400);
    } catch (err) {
      hideUploadProgress();
      console.error('Erro no envio:', err);
      alert('Erro ao enviar fotos para o Google Drive:\n' + err.message + '\n\nVerifique sua conexão e a URL configurada.');
      state.isSubmitting = false;
      renderPhotosGrid();
    }
  });

  function finishSuccess(info) {
    hideUploadProgress();

    // Preencher tela de sucesso
    successPredioNome.textContent = info.predioNome;
    successDataExecucao.textContent = info.dataExecucao;
    successFotosCount.textContent = `${info.fotosCount} fotos salvas`;
    btnOpenDriveFolder.href = info.folderUrl;
    btnOpenSheet.href = info.sheetUrl || '#';
    btnOpenSheet.classList.toggle('disabled-link', !info.sheetUrl);
    state.isSubmitting = false;

    // Avançar para tela 4
    goToStep(4);
  }

  // =========================================================================
  // 7. TELA 4: NOVO REGISTRO (RESET)
  // =========================================================================
  btnNewSubmission.addEventListener('click', () => {
    // Resetar campos de foto e observações
    state.attachedPhotos = [];
    state.selectedPlace = null;
    inputObservacoes.value = '';
    inputResponsavel.value = '';
    renderPhotosGrid();

    // Voltar para a Tela 1
    goToStep(1);
  });

  // =========================================================================
  // 8. HELPERS E CONFIGURAÇÕES
  // =========================================================================
  function formatarDataBR(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  }

  function showUploadProgress(title, subtitle, percent) {
    uploadStatusTitle.textContent = title;
    uploadStatusSubtitle.textContent = subtitle;
    updateUploadPercent(percent);
    uploadOverlay.classList.remove('hidden');
  }

  function updateUploadPercent(p) {
    const clamped = Math.min(Math.max(p, 0), 100);
    uploadProgressBar.style.width = clamped + '%';
    uploadProgressPercent.textContent = clamped + '%';
  }

  function hideUploadProgress() {
    uploadOverlay.classList.add('hidden');
  }

  function setupEventListeners() {
    // Busca na Tela 2
    inputSearchPredio.addEventListener('input', filterPlaces);
    btnClearSearch.addEventListener('click', () => {
      inputSearchPredio.value = '';
      filterPlaces();
      inputSearchPredio.focus();
    });

    // Botões de Voltar
    btnBackToScreen1.addEventListener('click', () => goToStep(1));
    btnBackToScreen2.addEventListener('click', () => goToStep(2));

    // Botão Adicionar Prédio Manual
    btnCustomPlace.addEventListener('click', handleCustomPlace);

    // Modal de Configurações
    btnOpenSettings.addEventListener('click', () => {
      inputScriptUrl.value = state.scriptUrl;
      settingsModal.classList.remove('hidden');
    });

    btnCloseSettings.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    btnSaveSettings.addEventListener('click', () => {
      const url = inputScriptUrl.value.trim();
      state.scriptUrl = url;
      localStorage.setItem('selim_gas_url', url);
      testScriptConnection(url);
      settingsModal.classList.add('hidden');
      alert(url ? 'Configuração salva. Testando a conexão com o Google...' : 'A conexão foi removida.');
    });

    // Fechar modal ao clicar fora
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    photoPreviewModal.addEventListener('click', (e) => {
      if (e.target === photoPreviewModal) photoPreviewModal.classList.add('hidden');
    });
  }

  async function testScriptConnection(url) {
    if (!url) {
      setConnectionStatus('error', 'Conexão ainda não configurada');
      return;
    }

    setConnectionStatus('checking', 'Verificando conexão com o Google Drive...');

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.status === 'ok') {
        setConnectionStatus('connected', 'Conectado ao Google Drive e à planilha');
      } else {
        setConnectionStatus('error', 'URL respondeu em formato não reconhecido');
      }
    } catch (e) {
      setConnectionStatus('error', 'Não foi possível verificar essa URL');
    }
  }

  function setConnectionStatus(status, message) {
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = message;
  }

  // Iniciar App
  init();
});
