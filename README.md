# 🏛️ SELIM • Registro Fotográfico de Prédios Públicos - Parnamirim

Aplicativo web mobile-first desenvolvido para a **SELIM (Secretaria / Coordenadoria de Limpeza Urbana de Parnamirim)** para registro de limpeza, vistorias e serviços realizados nos prédios públicos municipais.

O aplicativo funciona diretamente no celular de qualquer equipe, envia até 20 fotos para o **Google Drive** em uma pasta dedicada chamada `fotos selim predios publicos` e gera uma linha na **Planilha Google Sheets** com o link direto para a pasta que contém todas as fotos daquele envio.

---

## 📱 Fluxo do Aplicativo em 3 Telas

1. **Tela 1 - Categoria do Prédio**: Escolha entre UBS, Escolas Municipais, Centros Infantis (C.I.M.), SEMAS (CRAS/SCFV), Distrito Litoral ou Outros Prédios.
2. **Tela 2 - Seleção do Local / Prédio**: Lista completa dos 163 locais cadastrados na planilha oficial de Parnamirim 2026 com busca instantânea por nome, rua ou bairro, além de opção para cadastrar novos prédios.
3. **Tela 3 - Anexo de Fotos e Datas**:
   - Data da execução/visita (padrão: data atual).
   - Botão **📸 Tirar Foto** (aciona a câmera nativa do celular).
   - Botão **🖼️ Galeria** (seleciona várias fotos de uma vez, até 20 fotos).
   - Compressão inteligente no próprio celular para envio rápido em redes móveis (4G/5G).
   - Grade de fotos com visualização e botão de excluir.
4. **Tela 4 - Confirmação e Sucesso**: Exibe o resumo do envio e um botão direto **"📂 Abrir Pasta no Google Drive"** para visualizar todas as fotos salvas.

---

## 📂 Estrutura do Projeto

```
predios_publicos_app/
├── index.html                       # Página principal do aplicativo (SPA Mobile)
├── styles.css                       # Identidade visual oficial SELIM / Parnamirim
├── app.js                           # Lógica do app, compressão de imagem e requisições
├── data_predios.js                  # Base completa de prédios e locais oficiais
├── logo.png                         # Logo oficial de Parnamirim otimizada para web
├── icon-192.png / icon-512.png      # Ícones PWA para instalação no celular
├── manifest.json                    # Manifesto PWA (permite 'Adicionar à tela inicial')
├── backend/
│   └── codigo_google_apps_script.js # Código para o Google Apps Script (Drive + Sheets)
├── COMO_PUBLICAR_NO_GITHUB.md       # Passo a passo para colocar online no GitHub Pages
├── TUTORIAL_GOOGLE_DRIVE.md         # Tutorial para ativar o script no Google Drive
└── README.md                        # Documentação geral
```

---

## 🌐 Como Rodar e Testar Localmente

Basta abrir o arquivo `index.html` em qualquer navegador web (Google Chrome, Edge, Safari, Firefox) ou iniciar um servidor local simples:

```bash
python -m http.server 8080
```
Em seguida, acesse no navegador: `http://localhost:8080`

Para publicar online e acessar no seu celular de qualquer lugar, siga o guia em [COMO_PUBLICAR_NO_GITHUB.md](./COMO_PUBLICAR_NO_GITHUB.md).
