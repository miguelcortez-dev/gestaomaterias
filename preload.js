'use strict';
/**
 * Preload: única ponte entre a interface (sem acesso ao Node.js) e o processo
 * principal. Expõe somente as funções necessárias, em `window.api`.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /** Lê os dados do curso. Resolve com { dados, aviso? }. */
  carregar: () => ipcRenderer.invoke('dados:carregar'),

  /** Grava os dados do curso. Resolve com { ok, erro? }. */
  salvar: (dados) => ipcRenderer.invoke('dados:salvar', dados),
});
