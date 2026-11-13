/**
 * Ponto de entrada da interface: carrega os dados e liga estado e renderização.
 */
(function () {
  'use strict';
  const App = window.App;
  const { el } = App.ui;

  /** Mostra o conteúdo principal conforme o estado atual dos dados. */
  function renderizar(dados) {
    const quadro = document.getElementById('quadro');
    const texto = dados.configurado
      ? `${dados.periodos.length} período(s) configurado(s).`
      : 'Seu fluxograma aparecerá aqui.';
    quadro.replaceChildren(el('div', { class: 'vazio' }, el('p', { class: 'vazio-titulo' }, texto)));
  }

  /** Exibe um erro que impede o uso do app (os dados não são tocados). */
  function mostrarErroFatal(mensagem) {
    document.getElementById('quadro').replaceChildren(
      el('div', { class: 'vazio' }, [
        el('p', { class: 'vazio-titulo' }, 'Não foi possível abrir os dados do curso.'),
        el('p', {}, mensagem),
      ]),
    );
  }

  async function iniciar() {
    let resposta;
    try {
      resposta = await App.ipc.carregar();
    } catch (erro) {
      mostrarErroFatal(erro.message);
      return;
    }
    App.estado.aoAlterar(renderizar);
    App.estado.iniciar(resposta.dados);
    if (resposta.aviso) App.ui.toast(resposta.aviso, 'aviso', 10000);
  }

  iniciar();
})();
