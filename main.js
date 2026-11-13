'use strict';
/**
 * Processo principal do Electron.
 *
 * Responsável por criar a janela do aplicativo e controlar o seu ciclo de vida.
 */
const { app, BrowserWindow } = require('electron');
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
 * Ciclo de vida do aplicativo
 * ------------------------------------------------------------------ */

app.whenReady().then(() => {
  criarJanela();

  // macOS: recria a janela ao clicar no ícone do Dock se não houver nenhuma aberta.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
