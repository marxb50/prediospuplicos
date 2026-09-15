# Tutorial de Conexão: Google Drive e Planilha Google

Este tutorial ensina como ativar o script oficial do Google para que todas as fotos enviadas pelo aplicativo no celular sejam salvas automaticamente na pasta **`fotos selim predios publicos`** e registradas na sua Planilha Google com o **link único da pasta**.

---

## 🚀 Passo 1: Acessar o Google Apps Script

1. No computador ou no celular, acesse: **[script.google.com](https://script.google.com/)**
2. Faça login com a conta Google onde você deseja salvar as fotos e a planilha.
3. Clique no botão **"Novo projeto"** (ou **"New project"**).

---

## 📝 Passo 2: Colar o Código do Script

1. No editor de código que se abrirá, apague o código de exemplo `function myFunction() { ... }`.
2. Abra o arquivo [`backend/codigo_google_apps_script.js`](file:///d:/marxb/Downloads/papeleiras/predios_publicos_app/backend/codigo_google_apps_script.js) que criamos no seu projeto.
3. Copie todo o conteúdo desse arquivo e cole dentro do editor do Google Apps Script.
4. No topo, onde diz "Projeto sem título", clique e dê um nome, por exemplo: `SELIM - Fotos Predios Publicos`.
5. Clique no ícone de disquete no topo para **Salvar** (ou pressione `Ctrl + S`).

---

## 🌐 Passo 3: Implantar como App da Web

1. No canto superior direito da tela do Google Apps Script, clique no botão azul **"Implantar"** (ou **"Deploy"**) > **"Nova implantação"** (ou **"New deployment"**).
2. Na janela que se abrir, clique na engrenagem ao lado de "Selecionar tipo" e escolha **"App da Web"** (ou **"Web app"**).
3. Preencha as opções exatamente como abaixo:
   - **Descrição**: `API Fotos SELIM`
   - **Executar como**: `Eu (seu-email@gmail.com)`
   - **Quem pode acessar**: `Qualquer pessoa` (ou `Anyone`)
     *(Isso é necessário para que você e os encarregados possam enviar fotos pelo celular sem precisar fazer login complexo na tela).*
4. Clique no botão azul **"Implantar"**.
5. O Google solicitará permissão de acesso ao Drive e às Planilhas:
   - Clique em **"Autorizar acesso"**.
   - Escolha sua conta Google.
   - Se aparecer "O Google não verificou este app", clique no link pequeno **"Avançado"** (ou **"Advanced"**) no canto inferior esquerdo e depois clique em **"Acessar SELIM - Fotos Predios Publicos (não seguro)"**.
   - Clique em **"Permitir"**.
6. O Google exibirá a tela com a **URL do app da Web**. Ela se parece com:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
7. Clique em **"Copiar"** para copiar esta URL!

---

## 📱 Passo 4: Colar a URL no Aplicativo

1. Abra o aplicativo no seu navegador ou celular.
2. Toque no ícone da **engrenagem** no canto superior direito do cabeçalho.
3. Cole a URL copiada no campo **"URL da Implantação (Web App)"**.
4. Clique em **"Salvar Configuração"**.

Pronto! A bolinha ficará verde indicando conexão com o Google Drive!

---

## 📁 O Que Acontece Automaticamente no seu Google Drive:

1. Uma pasta chamada **`fotos selim predios publicos`** é criada automaticamente na raiz do seu Drive.
2. Cada vez que uma equipe envia fotos pelo celular, é criada uma subpasta organizada por data e nome:
   - Exemplo: `[15-09-2026] UBS BELA PARNAMIRIM`
3. Todas as fotos enviadas (seja 1 ou 20 fotos) ficam salvas dentro dessa mesma subpasta.
4. É criada uma Planilha Google chamada **`Controle de Fotos - Prédios Públicos SELIM`** contendo:
   - Carimbo de Data/Hora do envio
   - Data da Execução
   - Categoria (UBS, Escola, etc.)
   - Nome do Prédio
   - Endereço
   - Quantidade de fotos enviadas
   - **Link Único da Pasta** (ao clicar, abre todas as fotos de uma vez só no Drive!)
   - Responsável e Observações.
