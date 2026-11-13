/**
 * Renderização do fluxograma: transforma os dados em elementos na tela.
 * Não altera dados — as ações do usuário são tratadas em app.js, que usa
 * os atributos data-* gerados aqui (data-acao, data-periodo-id...).
 */
(function () {
  'use strict';
  const App = window.App;
  const { el, icone } = App.ui;

  const quadro = document.getElementById('quadro');

  /** Redesenha todo o quadro, preservando a posição de rolagem. */
  function renderizar(dados) {
    const { scrollLeft, scrollTop } = quadro;

    document.getElementById('btn-nova-materia').hidden = !dados.configurado;

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
    colunas.push(
      el('button', { type: 'button', class: 'coluna-nova', dataset: { acao: 'adicionar-periodo' }, title: 'Adicionar um período extra' }, [
        icone('mais'),
        'Período',
      ]),
    );

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
      el('button', {
        type: 'button',
        class: 'btn-mini',
        title: `Nova matéria no ${rotulo}`,
        'aria-label': `Nova matéria no ${rotulo}`,
        dataset: { acao: 'nova-materia', periodoId: periodo.id },
      }, icone('mais')),
      // Só é possível remover períodos vazios.
      materias.length === 0 && dados.periodos.length > 1
        ? el('button', {
          type: 'button',
          class: 'btn-mini',
          title: `Remover o ${rotulo}`,
          'aria-label': `Remover o ${rotulo}`,
          dataset: { acao: 'remover-periodo', periodoId: periodo.id },
        }, icone('fechar'))
        : null,
    ]);

    const corpo = el('div', { class: 'coluna-corpo', dataset: { periodoId: periodo.id } },
      materias.length
        ? materias.map((m) => renderizarCard(m))
        : el('p', { class: 'coluna-dica' }, 'Nenhuma matéria neste período.'));

    return el('section', {
      class: 'coluna' + (extra ? ' coluna-extra' : ''),
      dataset: { periodoId: periodo.id },
      'aria-label': rotulo + (extra ? ' (extra)' : ''),
    }, [cabecalho, corpo]);
  }

  /** Card de uma matéria: código, nome e carga horária. */
  function renderizarCard(materia) {
    const detalhes = [];
    if (materia.cargaHoraria !== null) detalhes.push(el('span', { class: 'card-ch' }, `${materia.cargaHoraria} h`));

    return el('article', {
      class: 'card',
      tabindex: '0',
      'aria-label': materia.nome,
      dataset: { id: materia.id },
    }, [
      materia.codigo ? el('div', { class: 'card-codigo' }, materia.codigo) : null,
      el('div', { class: 'card-nome' }, materia.nome),
      detalhes.length ? el('div', { class: 'card-rodape' }, detalhes) : null,
    ]);
  }

  App.render = { renderizar };
})();
