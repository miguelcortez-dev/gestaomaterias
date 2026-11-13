/**
 * Renderização do fluxograma: transforma os dados em elementos na tela.
 * Não altera dados — as ações do usuário são tratadas em app.js, que usa
 * os atributos data-* gerados aqui (data-acao, data-periodo-id...).
 */
(function () {
  'use strict';
  const App = window.App;
  const { el } = App.ui;

  const quadro = document.getElementById('quadro');

  /** Redesenha todo o quadro, preservando a posição de rolagem. */
  function renderizar(dados) {
    const { scrollLeft, scrollTop } = quadro;

    if (!dados.configurado) {
      quadro.replaceChildren(
        el('div', { class: 'vazio' }, [
          el('p', { class: 'vazio-titulo' }, 'Seu fluxograma aparecerá aqui.'),
          el('p', {}, 'Configure o número de períodos do curso para começar.'),
        ]),
      );
      return;
    }

    const colunas = dados.periodos.map((periodo, indice) => renderizarColuna(dados, periodo, indice));

    const conteudo = el('div', { class: 'quadro-conteudo', id: 'quadro-conteudo' }, [
      el('div', { class: 'colunas', id: 'colunas' }, colunas),
    ]);
    quadro.replaceChildren(conteudo);
    quadro.scrollLeft = scrollLeft;
    quadro.scrollTop = scrollTop;
  }

  /** Uma coluna = um período. Períodos além do previsto são marcados como "Extra". */
  function renderizarColuna(dados, periodo, indice) {
    const extra = indice >= dados.periodosBase;
    const materias = dados.materias.filter((m) => m.periodoId === periodo.id);
    const rotulo = Modelo.rotuloPeriodo(indice);

    const cabecalho = el('header', { class: 'coluna-cabecalho' }, [
      el('h2', { class: 'coluna-titulo' }, rotulo),
      extra ? el('span', { class: 'selo-extra', title: 'Período além do previsto pelo curso' }, 'Extra') : null,
      el('span', { class: 'coluna-info' }, materias.length === 1 ? '1 matéria' : `${materias.length} matérias`),
    ]);

    const corpo = el('div', { class: 'coluna-corpo', dataset: { periodoId: periodo.id } },
      materias.length ? [] : el('p', { class: 'coluna-dica' }, 'Nenhuma matéria neste período.'));

    return el('section', {
      class: 'coluna' + (extra ? ' coluna-extra' : ''),
      dataset: { periodoId: periodo.id },
      'aria-label': rotulo + (extra ? ' (extra)' : ''),
    }, [cabecalho, corpo]);
  }

  App.render = { renderizar };
})();
