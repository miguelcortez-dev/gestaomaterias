'use strict';
/**
 * Processo principal do Electron.
 *
 * Responsável por criar a janela do aplicativo e controlar o seu ciclo de vida.
 */
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

const TAMANHO_PADRAO = { width: 1280, height: 800 };
const TAMANHO_MINIMO = { width: 960, height: 600 };

/** Janela principal (única) do aplicativo. */
let janelaPrincipal = null;

/* ------------------------------------------------------------------ *
 * Janela principal
 * ------------------------------------------------------------------ */

function criarJanela() {
  janelaPrincipal = new BrowserWindow({
    ...TAMANHO_PADRAO,
    minWidth: TAMANHO_MINIMO.width,
    minHeight: TAMANHO_MINIMO.height,
    show: false, // exibe só quando o conteúdo estiver pronto (evita tela branca)
    backgroundColor: '#f3f5f9',
    title: 'Gestão de Matérias',
    webPreferences: {
      // O front-end não tem acesso ao Node.js; tudo passa pelo preload (contextBridge).
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  janelaPrincipal.once('ready-to-show', () => janelaPrincipal.show());
  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null;
  });

  janelaPrincipal.loadFile(path.join(__dirname, 'src', 'index.html'));
}

/* ------------------------------------------------------------------ *
 * Segurança
 * ------------------------------------------------------------------ */

/**
 * O app funciona 100% offline: nega qualquer permissão (câmera, notificações,
 * etc.) e cancela requisições de rede que, por algum motivo, sejam feitas.
 */
function aplicarSeguranca() {
  const sessao = session.defaultSession;
  sessao.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false));
  sessao.setPermissionCheckHandler(() => false);
  sessao.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_detalhes, responder) => responder({ cancel: true }),
  );
}

// Bloqueia navegação para fora do app, abertura de novas janelas e <webview>.
app.on('web-contents-created', (_evento, conteudo) => {
  conteudo.on('will-navigate', (evento) => evento.preventDefault());
  conteudo.on('will-redirect', (evento) => evento.preventDefault());
  conteudo.on('will-attach-webview', (evento) => evento.preventDefault());
  conteudo.setWindowOpenHandler(() => ({ action: 'deny' }));
});

/* ------------------------------------------------------------------ *
 * Ciclo de vida do aplicativo
 * ------------------------------------------------------------------ */

app.whenReady().then(() => {
  aplicarSeguranca();
  criarJanela();

  // macOS: recria a janela ao clicar no ícone do Dock se não houver nenhuma aberta.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
