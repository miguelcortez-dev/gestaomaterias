'use strict';
/**
 * Preload: única ponte entre a interface (sem acesso ao Node.js) e o processo
 * principal. Expõe somente as funções necessárias, em `window.api`.
 */
const { contextBridge, ipcRenderer } = require('electron');

/** Comandos do menu que a interface pode receber. */
const COMANDOS_DO_MENU = ['exportar', 'importar'];

contextBridge.exposeInMainWorld('api', {
  /** Lê os dados do curso. Resolve com { dados, aviso? }. */
  carregar: () => ipcRenderer.invoke('dados:carregar'),

  /** Grava os dados do curso. Resolve com { ok, erro? }. */
  salvar: (dados) => ipcRenderer.invoke('dados:salvar', dados),

  /** Exporta os dados para um arquivo escolhido pelo usuário. Resolve com { ok, caminho?, cancelado?, erro? }. */
  exportar: (dados) => ipcRenderer.invoke('dados:exportar', dados),

  /** Lê dados de um arquivo escolhido pelo usuário. Resolve com { ok, dados?, cancelado?, erro? }. */
  importar: () => ipcRenderer.invoke('dados:importar'),

  /** Registra quem trata os comandos vindos do menu da janela. */
  aoComandoDoMenu: (tratar) => {
    ipcRenderer.on('menu:comando', (_evento, comando) => {
      if (COMANDOS_DO_MENU.includes(comando)) tratar(comando);
    });
  },
});
