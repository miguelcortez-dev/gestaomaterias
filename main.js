'use strict';
/**
 * Processo principal do Electron.
 *
 * Responsabilidades:
 *  - criar a janela principal (instância única);
 *  - montar o menu em português;
 *  - aplicar as regras de segurança (sem navegação externa, sem permissões).
 */
const { app, BrowserWindow, Menu, session } = require('electron');
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
 * Menu
 * ------------------------------------------------------------------ */

function montarMenu() {
  const ehMac = process.platform === 'darwin';
  const modelo = [];

  if (ehMac) {
    modelo.push({
      label: app.name,
      submenu: [
        { role: 'about', label: `Sobre ${app.name}` },
        { type: 'separator' },
        { role: 'hide', label: `Ocultar ${app.name}` },
        { role: 'hideOthers', label: 'Ocultar outros' },
        { role: 'unhide', label: 'Mostrar tudo' },
        { type: 'separator' },
        { role: 'quit', label: `Encerrar ${app.name}` },
      ],
    });
  }

  modelo.push({
    label: 'Arquivo',
    submenu: [{ role: 'quit', label: 'Sair' }],
  });

  // Necessário para copiar/colar nos campos de texto (principalmente no macOS).
  modelo.push({
    label: 'Editar',
    submenu: [
      { role: 'cut', label: 'Recortar' },
      { role: 'copy', label: 'Copiar' },
      { role: 'paste', label: 'Colar' },
      { role: 'selectAll', label: 'Selecionar tudo' },
    ],
  });

  const itensExibir = [
    {
      label: 'Zoom',
      submenu: [
        { role: 'zoomIn', label: 'Aumentar', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', label: 'Diminuir' },
        { role: 'resetZoom', label: 'Tamanho original' },
      ],
    },
    { role: 'togglefullscreen', label: 'Tela cheia' },
  ];
  if (!app.isPackaged) {
    itensExibir.push(
      { type: 'separator' },
      { role: 'reload', label: 'Recarregar' },
      { role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' },
    );
  }
  modelo.push({ label: 'Exibir', submenu: itensExibir });

  Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
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

function iniciar() {
  aplicarSeguranca();
  montarMenu();
  criarJanela();

  // macOS: recria a janela ao clicar no ícone do Dock se não houver nenhuma aberta.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
}

// Instância única: se o app for aberto de novo, apenas foca a janela existente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!janelaPrincipal) return;
    if (janelaPrincipal.isMinimized()) janelaPrincipal.restore();
    janelaPrincipal.show();
    janelaPrincipal.focus();
  });
  app.whenReady().then(iniciar);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
