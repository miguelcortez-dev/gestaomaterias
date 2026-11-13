/**
 * Comunicação com o processo principal.
 * Envolve a API exposta pelo preload (window.api) e padroniza os erros, para
 * que o restante da interface não precise lidar com exceções de IPC.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const api = window.api;

  /** Carrega os dados do curso. Lança erro se o processo principal falhar. */
  function carregar() {
    return api.carregar();
  }

  /** Salva os dados. Sempre resolve com { ok, erro? }. */
  async function salvar(dados) {
    try {
      return await api.salvar(dados);
    } catch (erro) {
      return { ok: false, erro: erro.message };
    }
  }

  App.ipc = { carregar, salvar };
})();
