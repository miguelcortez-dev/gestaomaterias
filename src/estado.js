/**
 * Estado da aplicação.
 *
 * Guarda os dados do curso em memória e centraliza TODAS as alterações na
 * função `alterar`, que trabalha sobre uma cópia, valida o resultado, salva em
 * disco e avisa os interessados (renderização).
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  let dados = null;
  const ouvintes = new Set();

  /** Define os dados iniciais (ex.: carregados do disco). */
  function iniciar(novosDados) {
    dados = novosDados;
    notificar();
  }

  /** Dados atuais. Trate como somente leitura: altere sempre via `alterar`. */
  function obter() {
    return dados;
  }

  /** Registra uma função chamada a cada mudança dos dados. */
  function aoAlterar(ouvinte) {
    ouvintes.add(ouvinte);
  }

  function notificar() {
    ouvintes.forEach((ouvinte) => ouvinte(dados));
  }

  async function persistir() {
    const resposta = await App.ipc.salvar(dados);
    if (!resposta.ok) App.ui.toast('Não foi possível salvar: ' + resposta.erro, 'erro', 8000);
  }

  /**
   * Aplica uma alteração.
   * @param {string} descricao  descrição curta da ação (ex.: "Mover matéria")
   * @param {(rascunho: object) => (object|false|void)} mutador
   *        recebe uma cópia dos dados para modificar; pode devolver um objeto
   *        novo para substituí-los por completo, ou `false` para cancelar.
   * @returns {boolean} true se a alteração foi aplicada.
   */
  function alterar(descricao, mutador) {
    const antes = JSON.stringify(dados);
    const rascunho = JSON.parse(antes);
    const resultado = mutador(rascunho);
    if (resultado === false) return false;

    const novo = resultado && typeof resultado === 'object' ? resultado : rascunho;
    if (JSON.stringify(novo) === antes) return false; // nada mudou

    const validacao = Modelo.validarDados(novo);
    if (!validacao.ok) {
      console.error(`Alteração "${descricao}" rejeitada:`, validacao.erros);
      App.ui.toast('Operação não realizada: ' + validacao.erros[0], 'erro');
      return false;
    }

    dados = novo;
    persistir();
    notificar();
    return true;
  }

  App.estado = { iniciar, obter, aoAlterar, alterar };
})();
