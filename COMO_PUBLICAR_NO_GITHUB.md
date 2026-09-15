# Como Publicar o Aplicativo no GitHub Pages (Para Usar no Celular)

Este guia ensina como colocar o aplicativo online no seu GitHub gratuitamente, permitindo que você e sua equipe acessem o app direto pelo navegador do celular através de um link oficial (ex: `https://seuusuariono-github.github.io/predios-publicos/`).

---

## 📱 Passo 1: Criar o Repositório no GitHub

1. Acesse **[github.com](https://github.com/)** e faça login na sua conta.
2. Clique no botão verde **"New"** (ou no ícone `+` no canto superior direito > **New repository**).
3. No campo **Repository name**, digite um nome, por exemplo:
   ```
   predios-publicos
   ```
4. Deixe como **Public** (Público, para o GitHub Pages funcionar gratuitamente).
5. Deixe desmarcadas as opções de README (já temos todos os arquivos prontos).
6. Clique no botão verde **"Create repository"**.

---

## 💻 Passo 2: Enviar os Arquivos da sua Máquina para o GitHub

Abra o terminal (Prompt de Comando ou PowerShell) na pasta do aplicativo:
`d:\marxb\Downloads\papeleiras\predios_publicos_app`

E execute os seguintes comandos:

```bash
cd "d:\marxb\Downloads\papeleiras\predios_publicos_app"
git init
git add .
git commit -m "Versao inicial do App SELIM Predios Publicos"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/predios-publicos.git
git push -u origin main
```
*(Substitua `SEU_USUARIO` pelo seu nome de usuário no GitHub).*

> **Dica Alternativa (Sem Terminal):** Se preferir não usar comandos, você também pode simplesmente arrastar e soltar os arquivos desta pasta diretamente na página do repositório no site do GitHub clicando em **"uploading an existing file"**!

---

## 🌐 Passo 3: Ativar o GitHub Pages (Deixar Online)

1. No seu repositório no GitHub, clique na aba **"Settings"** (Engrenagem no topo).
2. No menu lateral esquerdo, clique em **"Pages"** (sob a seção "Code and automation").
3. Na seção **"Build and deployment"**:
   - Em **Source**, selecione: `Deploy from a branch`.
   - Em **Branch**, selecione `main` e a pasta `/(root)`.
   - Clique em **"Save"**.
4. Aguarde cerca de 1 a 2 minutos e atualize a página.
5. O GitHub exibirá uma barra verde com o link oficial do seu aplicativo:
   ```
   Your site is live at https://seu-usuario.github.io/predios-publicos/
   ```

---

## 📲 Passo 4: Como Abrir e Instalar no Celular

1. Abra o link gerado acima no navegador do seu smartphone (**Google Chrome** no Android ou **Safari** no iPhone).
2. O aplicativo abrirá com a identidade visual completa da SELIM e Parnamirim.
3. **Para instalar como Aplicativo na tela inicial do celular**:
   - **No Android (Chrome)**: Toque nos três pontinhos verticais no topo e selecione **"Adicionar à tela inicial"** ou **"Instalar aplicativo"**.
   - **No iPhone (Safari)**: Toque no botão de compartilhar (quadrado com seta para cima) e selecione **"Adicionar à Tela de Início"**.
4. Pronto! Um ícone oficial do **SELIM Fotos** aparecerá na tela do seu celular, funcionando em tela cheia como um app nativo!
