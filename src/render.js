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

    const svg = svgEl('svg', { id: 'setas', class: 'setas' });
    // Camada própria, acima dos cards, para a linha temporária ao criar ligações.
    const svgTemporario = svgEl('svg', { id: 'setas-temporarias', class: 'setas setas-temporarias' });
    const conteudo = el('div', { class: 'quadro-conteudo', id: 'quadro-conteudo' }, [
      el('div', { class: 'colunas', id: 'colunas' }, colunas),
      svg,
      svgTemporario,
    ]);
    quadro.replaceChildren(conteudo);
    quadro.scrollLeft = scrollLeft;
    quadro.scrollTop = scrollTop;
    desenharSetas();
  }

  /* ------------------------------------------------------------------ *
   * Setas de dependência (SVG sobreposto às colunas)
   * ------------------------------------------------------------------ */

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, atributos = {}) {
    const elemento = document.createElementNS(SVG_NS, tag);
    for (const [nome, valor] of Object.entries(atributos)) elemento.setAttribute(nome, valor);
    return elemento;
  }

  /** Pontas de seta: uma por estilo, pois a ponta não herda a cor da linha. */
  function criarDefinicoes() {
    const defs = svgEl('defs');
    for (const [id, classe] of [
      ['ponta', 'ponta'],
      ['ponta-exige', 'ponta exige'],
      ['ponta-libera', 'ponta libera'],
      ['ponta-alerta', 'ponta alerta'],
    ]) {
      const marcador = svgEl('marker', {
        id, viewBox: '0 0 10 10', refX: '9', refY: '5',
        markerWidth: '9', markerHeight: '9', markerUnits: 'userSpaceOnUse', orient: 'auto',
      });
      marcador.append(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', class: classe }));
      defs.append(marcador);
    }
    return defs;
  }

  /** Curva suave (Bézier cúbica) da direita de um card até a esquerda de outro. */
  function caminhoCurvo(x1, y1, x2, y2) {
    const folga = Math.max(40, Math.abs(x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + folga} ${y1}, ${x2 - folga} ${y2}, ${x2} ${y2}`;
  }

  /** Distribui n pontos de conexão ao longo da altura do card. */
  const pontoNaAltura = (caixa, i, n) => caixa.topo + (caixa.altura * (i + 1)) / (n + 1);

  /**
   * Redesenha todas as setas a partir da posição atual dos cards.
   * Chamado após cada renderização e sempre que o layout muda (redimensionar, zoom).
   */
  function desenharSetas() {
    const conteudo = document.getElementById('quadro-conteudo');
    const svg = document.getElementById('setas');
    if (!conteudo || !svg) return;
    const dados = App.estado.obter();

    for (const camada of conteudo.querySelectorAll('svg.setas')) {
      camada.setAttribute('width', conteudo.offsetWidth);
      camada.setAttribute('height', conteudo.offsetHeight);
    }
    const base = conteudo.getBoundingClientRect();

    // Posição de cada card, relativa ao conteúdo do quadro.
    const caixas = new Map();
    conteudo.querySelectorAll('.card').forEach((card) => {
      const r = card.getBoundingClientRect();
      caixas.set(card.dataset.id, {
        esquerda: r.left - base.left,
        direita: r.right - base.left,
        topo: r.top - base.top,
        altura: r.height,
        centro: r.top - base.top + r.height / 2,
      });
    });

    const ligacoes = [];
    for (const materia of dados.materias) {
      for (const requisito of materia.preRequisitos) {
        if (caixas.has(requisito) && caixas.has(materia.id)) ligacoes.push({ de: requisito, para: materia.id });
      }
    }

    // Cada card distribui suas saídas/entradas pela altura, ordenadas pela
    // posição vertical do outro card, para evitar cruzamentos desnecessários.
    const saidas = new Map();
    const entradas = new Map();
    for (const ligacao of ligacoes) {
      if (!saidas.has(ligacao.de)) saidas.set(ligacao.de, []);
      if (!entradas.has(ligacao.para)) entradas.set(ligacao.para, []);
      saidas.get(ligacao.de).push(ligacao);
      entradas.get(ligacao.para).push(ligacao);
    }
    saidas.forEach((lista) => lista.sort((a, b) => caixas.get(a.para).centro - caixas.get(b.para).centro));
    entradas.forEach((lista) => lista.sort((a, b) => caixas.get(a.de).centro - caixas.get(b.de).centro));

    const nomes = new Map(dados.materias.map((m) => [m.id, m.nome]));
    const grupos = ligacoes.map((ligacao) => {
      const origem = caixas.get(ligacao.de);
      const destino = caixas.get(ligacao.para);
      const listaSaida = saidas.get(ligacao.de);
      const listaEntrada = entradas.get(ligacao.para);
      const d = caminhoCurvo(
        origem.direita, pontoNaAltura(origem, listaSaida.indexOf(ligacao), listaSaida.length),
        destino.esquerda - 1, pontoNaAltura(destino, listaEntrada.indexOf(ligacao), listaEntrada.length),
      );

      const grupo = svgEl('g', { class: 'seta' });
      Object.assign(grupo.dataset, { acao: 'remover-ligacao', de: ligacao.de, para: ligacao.para });
      const titulo = svgEl('title');
      titulo.textContent = `${nomes.get(ligacao.de)} → ${nomes.get(ligacao.para)} (clique para remover)`;
      // A "área" é uma linha larga e invisível que facilita acertar o clique.
      grupo.append(titulo, svgEl('path', { class: 'seta-area', d }), svgEl('path', { class: 'seta-linha', d }));
      return grupo;
    });

    svg.replaceChildren(criarDefinicoes(), ...grupos);
  }

  /* ------------------------------------------------------------------ *
   * Destaque de dependências
   * ------------------------------------------------------------------ */

  /**
   * Destaca a matéria `id`, tudo o que ela exige e tudo o que ela libera
   * (direta ou indiretamente); o restante fica esmaecido. `id` nulo limpa.
   * @param {string|null} id          matéria em foco (mouse por cima ou selecionada)
   * @param {string|null} selecionada matéria selecionada por clique
   */
  function aplicarDestaque(id, selecionada) {
    const dados = App.estado.obter();
    const legenda = document.getElementById('legenda-destaque');
    const materia = id ? dados.materias.find((m) => m.id === id) : null;
    const exige = materia ? Modelo.requisitosDe(dados.materias, id) : new Set();
    const libera = materia ? Modelo.liberadasPor(dados.materias, id) : new Set();

    quadro.classList.toggle('com-destaque', !!materia);
    quadro.querySelectorAll('.card').forEach((card) => {
      const cid = card.dataset.id;
      card.classList.toggle('selecionada', cid === selecionada);
      card.classList.toggle('foco', !!materia && cid === id);
      card.classList.toggle('exige', exige.has(cid));
      card.classList.toggle('libera', libera.has(cid));
    });
    quadro.querySelectorAll('#setas .seta').forEach((seta) => {
      const { de, para } = seta.dataset;
      seta.classList.toggle('destaque-exige', exige.has(de) && (para === id || exige.has(para)));
      seta.classList.toggle('destaque-libera', (de === id || libera.has(de)) && libera.has(para));
    });

    legenda.hidden = !materia;
    if (materia) {
      legenda.replaceChildren(
        el('strong', {}, materia.nome),
        el('span', { class: 'legenda-item exige' }, `Exige ${exige.size}`),
        el('span', { class: 'legenda-item libera' }, `Libera ${libera.size}`),
      );
    }
  }

  /** Coordenadas de um ponto da tela relativas ao conteúdo do quadro. */
  function pontoNoConteudo(clientX, clientY) {
    const base = document.getElementById('quadro-conteudo').getBoundingClientRect();
    return { x: clientX - base.left, y: clientY - base.top };
  }

  /** Linha tracejada exibida enquanto o usuário arrasta para criar uma ligação. */
  function desenharLinhaTemporaria(x1, y1, x2, y2) {
    const svg = document.getElementById('setas-temporarias');
    if (!svg) return;
    let linha = svg.querySelector('.seta-temporaria');
    if (!linha) {
      linha = svgEl('path', { class: 'seta-temporaria' });
      svg.append(linha);
    }
    linha.setAttribute('d', caminhoCurvo(x1, y1, x2, y2));
  }

  function limparLinhaTemporaria() {
    const svg = document.getElementById('setas-temporarias');
    if (svg) svg.replaceChildren();
  }

  App.render = { renderizar, desenharSetas, aplicarDestaque, descreverReprovacao, pontoNoConteudo, desenharLinhaTemporaria, limparLinhaTemporaria };

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

  /** Classe CSS do status (ex.: "Aprovada" → "status-aprovada"). */
  const classeStatus = (status) => 'status-' + status.toLowerCase();

  /** Texto de uma reprovação do histórico (ex.: "Reprovada no 3º período em 12/11/2026"). */
  function descreverReprovacao(registro) {
    const data = registro.data.split('-').reverse().join('/');
    return `Reprovada no ${registro.periodo}º período em ${data}`;
  }

  /** Card de uma matéria: código, nome, carga horária, status e tentativa. */
  function renderizarCard(materia) {
    const detalhes = [el('span', { class: `selo-status ${classeStatus(materia.status)}` }, materia.status)];
    if (materia.tentativas > 1) {
      detalhes.push(el('span', {
        class: 'selo-tentativa',
        title: materia.historico.map(descreverReprovacao).join('\n'),
      }, `${materia.tentativas}ª tentativa`));
    }
    if (materia.cargaHoraria !== null) detalhes.push(el('span', { class: 'card-ch' }, `${materia.cargaHoraria} h`));

    const acoes = el('div', { class: 'card-acoes' }, [
      el('button', {
        type: 'button', class: 'btn-mini', title: 'Editar', 'aria-label': `Editar ${materia.nome}`,
        dataset: { acao: 'editar-materia', id: materia.id },
      }, icone('editar')),
      el('button', {
        type: 'button', class: 'btn-mini perigo', title: 'Excluir', 'aria-label': `Excluir ${materia.nome}`,
        dataset: { acao: 'excluir-materia', id: materia.id },
      }, icone('excluir')),
    ]);

    return el('article', {
      class: `card ${classeStatus(materia.status)}`,
      tabindex: '0',
      'aria-label': materia.nome,
      title: 'Arraste para outro período ou clique duas vezes para editar',
      draggable: 'true',
      dataset: { id: materia.id },
    }, [
      acoes,
      materia.codigo ? el('div', { class: 'card-codigo' }, materia.codigo) : null,
      el('div', { class: 'card-nome' }, materia.nome),
      el('div', { class: 'card-rodape' }, detalhes),
      // Ponto de conexão: arrastar daqui até outro card cria a ligação.
      el('span', {
        class: 'conector',
        title: 'Arraste até a matéria que depende desta para ligá-las',
        'aria-hidden': 'true',
      }),
    ]);
  }

})();
