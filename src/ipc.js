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

  /** Exporta os dados. Sempre resolve com { ok, caminho?, cancelado?, erro? }. */
  async function exportar(dados) {
    try {
      return await api.exportar(dados);
    } catch (erro) {
      return { ok: false, erro: erro.message };
    }
  }

  /** Importa dados de um arquivo. Sempre resolve com { ok, dados?, cancelado?, erro? }. */
  async function importar() {
    try {
      return await api.importar();
    } catch (erro) {
      return { ok: false, erro: erro.message };
    }
  }

  /** Lê o tema atual. Em caso de falha, assume o claro. */
  async function obterTema() {
    try {
      return await api.obterTema();
    } catch {
      return { tema: 'sistema', escuro: false };
    }
  }

  /** Define o tema. Sempre resolve com { ok, tema?, escuro?, erro? }. */
  async function definirTema(tema) {
    try {
      return await api.definirTema(tema);
    } catch (erro) {
      return { ok: false, erro: erro.message };
    }
  }

  /** Registra o tratamento das mudanças de tema. */
  function aoAlterarTema(tratar) {
    api.aoAlterarTema(tratar);
  }

  /** Registra o tratamento dos comandos do menu (Arquivo › Exportar/Importar...). */
  function aoComandoDoMenu(tratar) {
    api.aoComandoDoMenu(tratar);
  }

  App.ipc = { carregar, salvar, exportar, importar, obterTema, definirTema, aoAlterarTema, aoComandoDoMenu };
})();
