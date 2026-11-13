/**
 * Ponto de entrada da interface: carrega os dados, liga estado e renderização
 * e trata as ações do usuário.
 */
(function () {
  'use strict';
  const App = window.App;
  const { el, toast } = App.ui;
  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------ *
   * Configuração do curso (número de períodos previstos)
   * ------------------------------------------------------------------ */

  /**
   * Ajusta a lista de períodos ao novo número previsto. Ao aumentar, cria os
   * períodos que faltam; ao diminuir, remove do fim apenas períodos vazios —
   * os que tiverem matérias continuam existindo, agora como "extras".
   */
  function aplicarPeriodosBase(rascunho, quantidade) {
    rascunho.periodosBase = quantidade;
    rascunho.configurado = true;
    while (rascunho.periodos.length < quantidade) {
      rascunho.periodos.push({ id: Modelo.gerarId('p') });
    }
    while (rascunho.periodos.length > quantidade) {
      const ultimo = rascunho.periodos[rascunho.periodos.length - 1];
      if (rascunho.materias.some((m) => m.periodoId === ultimo.id)) break;
      rascunho.periodos.pop();
    }
  }

  function abrirConfiguracao() {
    const dados = App.estado.obter();
    const primeiraVez = !dados.configurado;
    $('config-intro').textContent = primeiraVez
      ? 'Bem-vindo! Para montar o fluxograma, informe quantos períodos o seu curso prevê.'
      : 'Altere o número de períodos previstos pelo curso.';
    $('config-periodos').value = dados.periodosBase;
    $('config-cancelar').hidden = primeiraVez;
    $('config-erro').hidden = true;
    $('dlg-config').showModal();
    $('config-periodos').select();
  }

  function salvarConfiguracao(evento) {
    evento.preventDefault();
    const valor = Number($('config-periodos').value);
    if (!Number.isInteger(valor) || valor < 1 || valor > Modelo.LIMITE_PERIODOS_BASE) {
      $('config-erro').textContent = `Informe um número inteiro entre 1 e ${Modelo.LIMITE_PERIODOS_BASE}.`;
      $('config-erro').hidden = false;
      return;
    }
    App.estado.alterar('Configurar períodos', (rascunho) => aplicarPeriodosBase(rascunho, valor));
    $('dlg-config').close();

    const dados = App.estado.obter();
    if (dados.periodos.length > valor) {
      toast('Os períodos além do previsto que já têm matérias foram mantidos como extras.', 'info', 6000);
    }
  }

  function ligarConfiguracao() {
    $('btn-config').addEventListener('click', abrirConfiguracao);
    $('form-config').addEventListener('submit', salvarConfiguracao);
    $('config-cancelar').addEventListener('click', () => $('dlg-config').close());
    // Na primeira execução a configuração é obrigatória: Esc não fecha o diálogo
    // e, se ele for fechado de outra forma, é reaberto.
    const obrigatoria = () => !App.estado.obter().configurado;
    $('dlg-config').addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && obrigatoria()) evento.preventDefault();
    });
    $('dlg-config').addEventListener('cancel', (evento) => {
      if (obrigatoria()) evento.preventDefault();
    });
    $('dlg-config').addEventListener('close', () => {
      if (obrigatoria()) abrirConfiguracao();
    });
  }

  /* ------------------------------------------------------------------ *
   * Períodos: adicionar e remover
   * ------------------------------------------------------------------ */

  function adicionarPeriodo() {
    if (App.estado.obter().periodos.length >= Modelo.LIMITE_PERIODOS) {
      toast(`O limite é de ${Modelo.LIMITE_PERIODOS} períodos.`, 'aviso');
      return;
    }
    App.estado.alterar('Adicionar período', (rascunho) => {
      rascunho.periodos.push({ id: Modelo.gerarId('p') });
    });
    // Mostra a nova coluna, que fica no fim do quadro.
    $('quadro').scrollTo({ left: $('quadro').scrollWidth, behavior: 'smooth' });
  }

  async function removerPeriodo(periodoId) {
    const dados = App.estado.obter();
    const indice = dados.periodos.findIndex((p) => p.id === periodoId);
    if (indice < 0) return;
    const rotulo = Modelo.rotuloPeriodo(indice);

    if (dados.materias.some((m) => m.periodoId === periodoId)) {
      toast('Só é possível remover um período vazio. Mova ou exclua as matérias dele antes.', 'aviso');
      return;
    }
    if (dados.periodos.length === 1) {
      toast('O curso precisa ter pelo menos um período.', 'aviso');
      return;
    }

    // Remover um período previsto (não extra) diminui o número de períodos do curso.
    const ehBase = indice < dados.periodosBase;
    if (ehBase && dados.periodosBase === 1) {
      toast('O curso precisa prever pelo menos um período.', 'aviso');
      return;
    }
    const confirmado = await App.ui.confirmar({
      titulo: `Remover o ${rotulo}?`,
      mensagem: ehBase
        ? `Este período faz parte dos ${dados.periodosBase} previstos pelo curso. Ao removê-lo, o curso passará a prever ${dados.periodosBase - 1} período(s) e os seguintes serão renumerados.`
        : 'Este período extra está vazio e será removido. Os períodos seguintes serão renumerados.',
      confirmar: 'Remover',
      perigo: true,
    });
    if (!confirmado) return;

    App.estado.alterar('Remover período', (rascunho) => {
      rascunho.periodos.splice(indice, 1);
      if (ehBase) rascunho.periodosBase -= 1;
    });
  }

  /* ------------------------------------------------------------------ *
   * Matérias: formulário de cadastro/edição
   * ------------------------------------------------------------------ */

  /** Id da matéria aberta no formulário (null = nova matéria). */
  let materiaEmEdicao = null;

  /** Preenche um <select> com os períodos existentes. */
  function preencherPeriodos(select, dados, selecionado) {
    select.replaceChildren(
      ...dados.periodos.map((p, i) =>
        el('option', { value: p.id }, Modelo.rotuloPeriodo(i) + (i >= dados.periodosBase ? ' (extra)' : ''))),
    );
    select.value = selecionado;
  }

  /** Nome de exibição de uma matéria pelo id. */
  function nomeMateria(id) {
    const materia = App.estado.obter().materias.find((m) => m.id === id);
    return materia ? materia.nome : '?';
  }

  /** Texto de um ciclo, ex.: "Cálculo I → Cálculo II → Cálculo I". */
  const descreverCiclo = (ids) => ids.map(nomeMateria).join(' → ');

  /** Texto sem acentos e em minúsculas, para buscas. */
  const paraBusca = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /**
   * Monta a lista de pré-requisitos (caixas de seleção agrupadas por período).
   * Matérias que já dependem da matéria em edição ficam bloqueadas, pois
   * escolhê-las criaria uma dependência circular.
   */
  function preencherPreRequisitos(dados, materia) {
    const selecionados = new Set(materia ? materia.preRequisitos : []);
    const bloqueadas = materia ? Modelo.liberadasPor(dados.materias, materia.id) : new Set();

    const grupos = dados.periodos.map((periodo, indice) => {
      const itens = dados.materias.filter((m) => m.periodoId === periodo.id && (!materia || m.id !== materia.id));
      if (!itens.length) return null;
      return el('div', { class: 'opcoes-grupo' }, [
        el('div', { class: 'opcoes-grupo-titulo' }, Modelo.rotuloPeriodo(indice)),
        ...itens.map((m) => {
          const bloqueada = bloqueadas.has(m.id) && !selecionados.has(m.id);
          return el('label', {
            class: 'opcao' + (bloqueada ? ' bloqueada' : ''),
            title: bloqueada ? 'Esta matéria depende da que está sendo editada; usá-la como pré-requisito criaria um ciclo.' : null,
            dataset: { busca: paraBusca(`${m.nome} ${m.codigo}`) },
          }, [
            el('input', { type: 'checkbox', value: m.id, checked: selecionados.has(m.id), disabled: bloqueada }),
            m.codigo ? el('span', { class: 'opcao-codigo' }, m.codigo) : null,
            el('span', { class: 'opcao-nome' }, m.nome),
            bloqueada ? el('span', { class: 'opcao-nota' }, 'criaria ciclo') : null,
          ]);
        }),
      ]);
    }).filter(Boolean);

    $('prereq-lista').replaceChildren(...(grupos.length
      ? grupos
      : [el('p', { class: 'ajuda lista-vazia' }, 'Cadastre outras matérias para poder ligá-las como pré-requisitos.')]));
    $('prereq-busca').value = '';
    $('prereq-busca').hidden = !grupos.length;
    atualizarResumoPreRequisitos();
  }

  function atualizarResumoPreRequisitos() {
    const total = $('prereq-lista').querySelectorAll('input:checked').length;
    $('prereq-resumo').textContent = total ? `(${total} selecionado${total > 1 ? 's' : ''})` : '';
  }

  function filtrarPreRequisitos() {
    const termo = paraBusca($('prereq-busca').value.trim());
    $('prereq-lista').querySelectorAll('.opcoes-grupo').forEach((grupo) => {
      let visiveis = 0;
      grupo.querySelectorAll('.opcao').forEach((opcao) => {
        const mostra = !termo || opcao.dataset.busca.includes(termo);
        opcao.hidden = !mostra;
        if (mostra) visiveis++;
      });
      grupo.hidden = visiveis === 0;
    });
  }

  /**
   * Abre o formulário.
   * @param {string|null} id         matéria a editar, ou null para criar
   * @param {string|null} periodoId  período sugerido para uma matéria nova
   */
  function abrirFormularioMateria(id = null, periodoId = null) {
    const dados = App.estado.obter();
    if (!dados.configurado) return;
    const materia = id ? dados.materias.find((m) => m.id === id) : null;
    if (id && !materia) return;

    materiaEmEdicao = materia ? materia.id : null;
    $('materia-titulo').textContent = materia ? 'Editar matéria' : 'Nova matéria';
    $('materia-nome').value = materia ? materia.nome : '';
    $('materia-codigo').value = materia ? materia.codigo : '';
    $('materia-ch').value = materia && materia.cargaHoraria !== null ? materia.cargaHoraria : '';
    preencherPeriodos($('materia-periodo'), dados, materia ? materia.periodoId : periodoId || dados.periodos[0].id);
    $('materia-status').replaceChildren(...Modelo.STATUS.map((s) => el('option', { value: s }, s)));
    $('materia-status').value = materia ? materia.status : Modelo.STATUS[0];
    preencherPreRequisitos(dados, materia);
    $('materia-erro').hidden = true;
    $('materia-excluir').hidden = !materia;

    // Histórico de tentativas (somente leitura).
    const historico = materia ? materia.historico : [];
    $('materia-historico').hidden = !historico.length;
    $('materia-historico').replaceChildren(
      el('span', { class: 'campo-rotulo' }, `Histórico de tentativas (atual: ${materia ? materia.tentativas : 1}ª)`),
      el('ul', {}, historico.map((registro) => el('li', {}, App.render.descreverReprovacao(registro)))),
    );

    $('dlg-materia').showModal();
    $('materia-nome').focus();
  }

  function mostrarErroMateria(mensagem, campo) {
    $('materia-erro').textContent = mensagem;
    $('materia-erro').hidden = false;
    if (campo) $(campo).focus();
  }

  /** Lê e valida os campos do formulário. */
  function lerFormularioMateria() {
    const nome = $('materia-nome').value.trim();
    if (!nome) return { erro: 'Informe o nome da matéria.', campo: 'materia-nome' };

    const campoCh = $('materia-ch');
    let cargaHoraria = null;
    if (campoCh.validity.badInput || campoCh.value.trim() !== '') {
      const numero = Number(campoCh.value);
      if (campoCh.validity.badInput || !Number.isInteger(numero) || numero < 0 || numero > Modelo.LIMITE_CARGA_HORARIA) {
        return {
          erro: `A carga horária deve ser um número inteiro de horas, entre 0 e ${Modelo.LIMITE_CARGA_HORARIA}.`,
          campo: 'materia-ch',
        };
      }
      cargaHoraria = numero;
    }

    const preRequisitos = [...$('prereq-lista').querySelectorAll('input:checked')].map((caixa) => caixa.value);
    if (materiaEmEdicao) {
      const materias = App.estado.obter().materias;
      for (const requisito of preRequisitos) {
        const ciclo = Modelo.cicloAoLigar(materias, requisito, materiaEmEdicao);
        if (ciclo) {
          return {
            erro: `"${nomeMateria(requisito)}" não pode ser pré-requisito desta matéria: isso criaria uma dependência circular (${descreverCiclo(ciclo)}).`,
          };
        }
      }
    }

    return {
      valores: {
        nome,
        codigo: $('materia-codigo').value.trim(),
        cargaHoraria,
        periodoId: $('materia-periodo').value,
        status: $('materia-status').value,
        preRequisitos,
      },
    };
  }

  function salvarMateria(evento) {
    evento.preventDefault();
    const { erro, campo, valores } = lerFormularioMateria();
    if (erro) {
      mostrarErroMateria(erro, campo);
      return;
    }

    let aplicado;
    let id = materiaEmEdicao;
    let statusAnterior = null;
    if (id) {
      statusAnterior = App.estado.obter().materias.find((m) => m.id === id).status;
      aplicado = App.estado.alterar('Editar matéria', (rascunho) => {
        Object.assign(rascunho.materias.find((m) => m.id === id), valores);
      });
    } else {
      const nova = Modelo.criarMateria(valores);
      id = nova.id;
      aplicado = App.estado.alterar('Adicionar matéria', (rascunho) => {
        rascunho.materias.push(nova);
      });
    }
    // Editar sem mudar nada também fecha o formulário.
    if (!aplicado && !materiaEmEdicao) return;
    $('dlg-materia').close();

    if (aplicado && valores.status === 'Reprovada' && statusAnterior !== 'Reprovada') oferecerRecolocacao(id);
  }

  /* ------------------------------------------------------------------ *
   * Reprovação: recolocar a matéria em um período posterior
   * ------------------------------------------------------------------ */

  const NOVO_PERIODO = '__novo__';
  /** Matéria aguardando a decisão no diálogo de reprovação. */
  let materiaReprovada = null;

  /** Data local de hoje no formato AAAA-MM-DD. */
  function hojeIso() {
    const hoje = new Date();
    const doisDigitos = (n) => String(n).padStart(2, '0');
    return `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`;
  }

  /** Pergunta se a matéria reprovada deve ir para um período posterior. */
  function oferecerRecolocacao(id) {
    const dados = App.estado.obter();
    const materia = dados.materias.find((m) => m.id === id);
    if (!materia) return;
    const indiceAtual = dados.periodos.findIndex((p) => p.id === materia.periodoId);

    const opcoes = dados.periodos.slice(indiceAtual + 1).map((p, i) => {
      const indice = indiceAtual + 1 + i;
      return el('option', { value: p.id }, Modelo.rotuloPeriodo(indice) + (indice >= dados.periodosBase ? ' (extra)' : ''));
    });
    if (dados.periodos.length < Modelo.LIMITE_PERIODOS) {
      opcoes.push(el('option', { value: NOVO_PERIODO }, `Novo período extra (${Modelo.rotuloPeriodo(dados.periodos.length)})`));
    }
    if (!opcoes.length) {
      toast('Não há períodos posteriores disponíveis para recolocar a matéria.', 'aviso');
      return;
    }

    materiaReprovada = id;
    $('reprovacao-mensagem').textContent =
      `"${materia.nome}" foi marcada como reprovada no ${Modelo.rotuloPeriodo(indiceAtual)}. ` +
      'Deseja recolocá-la em um período posterior para cursar novamente?';
    $('reprovacao-periodo').replaceChildren(...opcoes);
    $('reprovacao-periodo').selectedIndex = 0;
    $('dlg-reprovacao').showModal();
  }

  /** Registra a reprovação no histórico e move a matéria (criando um período extra se pedido). */
  function recolocarMateria(id, destino) {
    let novoPeriodoId = destino;
    const aplicado = App.estado.alterar('Recolocar matéria reprovada', (rascunho) => {
      const materia = rascunho.materias.find((m) => m.id === id);
      if (!materia) return false;
      if (destino === NOVO_PERIODO) {
        const periodo = { id: Modelo.gerarId('p') };
        rascunho.periodos.push(periodo);
        novoPeriodoId = periodo.id;
      }
      const indiceAtual = rascunho.periodos.findIndex((p) => p.id === materia.periodoId);
      materia.historico.push({ periodo: indiceAtual + 1, data: hojeIso() });
      materia.tentativas += 1;
      materia.status = 'Pendente';
      materia.periodoId = novoPeriodoId;
    });
    if (!aplicado) return;

    const dados = App.estado.obter();
    const materia = dados.materias.find((m) => m.id === id);
    const indice = dados.periodos.findIndex((p) => p.id === novoPeriodoId);
    toast(`"${materia.nome}" foi recolocada no ${Modelo.rotuloPeriodo(indice)} (${materia.tentativas}ª tentativa).`, 'sucesso');
  }

  function ligarReprovacao() {
    $('form-reprovacao').addEventListener('submit', (evento) => {
      evento.preventDefault();
      const id = materiaReprovada;
      const destino = $('reprovacao-periodo').value;
      $('dlg-reprovacao').close();
      recolocarMateria(id, destino);
    });
    $('reprovacao-manter').addEventListener('click', () => $('dlg-reprovacao').close());
    $('dlg-reprovacao').addEventListener('close', () => {
      materiaReprovada = null;
    });
  }

  /**
   * Exclui uma matéria após confirmação.
   * @returns {Promise<boolean>} true se foi excluída.
   */
  async function excluirMateria(id) {
    const materias = App.estado.obter().materias;
    const materia = materias.find((m) => m.id === id);
    if (!materia) return false;

    const ligacoes = materia.preRequisitos.length + materias.filter((m) => m.preRequisitos.includes(id)).length;
    const confirmado = await App.ui.confirmar({
      titulo: 'Excluir matéria?',
      mensagem: `A matéria "${materia.nome}" será excluída do fluxograma` +
        (ligacoes ? `, junto com ${ligacoes === 1 ? 'a ligação associada' : `as ${ligacoes} ligações associadas`}.` : '.'),
      confirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmado) return false;

    // Remove a matéria e as ligações em que ela aparece como pré-requisito.
    return App.estado.alterar('Excluir matéria', (rascunho) => {
      rascunho.materias = rascunho.materias.filter((m) => m.id !== id);
      rascunho.materias.forEach((m) => {
        m.preRequisitos = m.preRequisitos.filter((p) => p !== id);
      });
    });
  }

  function ligarFormularioMateria() {
    $('btn-nova-materia').addEventListener('click', () => abrirFormularioMateria());
    $('form-materia').addEventListener('submit', salvarMateria);
    $('materia-cancelar').addEventListener('click', () => $('dlg-materia').close());
    $('prereq-busca').addEventListener('input', filtrarPreRequisitos);
    $('prereq-lista').addEventListener('change', atualizarResumoPreRequisitos);
    $('materia-excluir').addEventListener('click', async () => {
      if (await excluirMateria(materiaEmEdicao)) $('dlg-materia').close();
    });
  }

  /* ------------------------------------------------------------------ *
   * Matérias: arrastar e soltar entre períodos
   * ------------------------------------------------------------------ */

  /**
   * Move a matéria para um período, posicionando-a antes de outra matéria
   * (ou no fim da coluna, se `antesDeId` for null).
   */
  function moverMateria(id, periodoId, antesDeId) {
    App.estado.alterar('Mover matéria', (rascunho) => {
      const lista = rascunho.materias;
      const origem = lista.findIndex((m) => m.id === id);
      if (origem < 0) return false;
      const [materia] = lista.splice(origem, 1);
      materia.periodoId = periodoId;

      let destino = antesDeId ? lista.findIndex((m) => m.id === antesDeId) : -1;
      if (destino < 0) {
        // Fim da coluna: logo após a última matéria do período (ou no fim da lista).
        const ultima = lista.map((m) => m.periodoId).lastIndexOf(periodoId);
        destino = ultima < 0 ? lista.length : ultima + 1;
      }
      lista.splice(destino, 0, materia);
    });
  }

  /** Id da matéria sendo arrastada (null quando não há arraste). */
  let arrastando = null;
  /** Linha que indica onde o card será solto. */
  const marcadorSoltar = el('div', { class: 'marcador-soltar', 'aria-hidden': 'true' });

  /** Primeiro card da coluna abaixo do ponteiro (ou null = fim da coluna). */
  function cardAbaixoDoPonteiro(corpo, y) {
    const cards = [...corpo.querySelectorAll('.card:not(.arrastando)')];
    return cards.find((card) => {
      const r = card.getBoundingClientRect();
      return y < r.top + r.height / 2;
    }) || null;
  }

  function finalizarArraste() {
    arrastando = null;
    marcadorSoltar.remove();
    document.querySelectorAll('.card.arrastando').forEach((c) => c.classList.remove('arrastando'));
    document.querySelectorAll('.coluna.alvo-soltar').forEach((c) => c.classList.remove('alvo-soltar'));
  }

  function ligarArrastarCards() {
    const quadro = $('quadro');

    quadro.addEventListener('dragstart', (evento) => {
      const card = evento.target instanceof Element && evento.target.closest('.card');
      if (!card) return;
      if (conexao) {
        // O usuário está criando uma ligação pela bolinha, não movendo o card.
        evento.preventDefault();
        return;
      }
      arrastando = card.dataset.id;
      sobMouse = null;
      atualizarDestaque();
      evento.dataTransfer.effectAllowed = 'move';
      evento.dataTransfer.setData('text/plain', arrastando);
      requestAnimationFrame(() => card.classList.add('arrastando'));
    });

    quadro.addEventListener('dragover', (evento) => {
      if (!arrastando) return;
      const coluna = evento.target instanceof Element && evento.target.closest('.coluna');
      if (!coluna) return;
      evento.preventDefault(); // permite soltar aqui
      evento.dataTransfer.dropEffect = 'move';

      document.querySelectorAll('.coluna.alvo-soltar').forEach((c) => c !== coluna && c.classList.remove('alvo-soltar'));
      coluna.classList.add('alvo-soltar');
      const corpo = coluna.querySelector('.coluna-corpo');
      const abaixo = cardAbaixoDoPonteiro(corpo, evento.clientY);
      if (abaixo) {
        if (marcadorSoltar.nextElementSibling !== abaixo) corpo.insertBefore(marcadorSoltar, abaixo);
      } else if (corpo.lastElementChild !== marcadorSoltar) {
        corpo.append(marcadorSoltar);
      }
    });

    quadro.addEventListener('drop', (evento) => {
      if (!arrastando) return;
      const coluna = evento.target instanceof Element && evento.target.closest('.coluna');
      if (!coluna) return;
      evento.preventDefault();

      // O próximo card após o marcador (ignorando o próprio card arrastado).
      let proximo = marcadorSoltar.nextElementSibling;
      while (proximo && proximo.classList.contains('arrastando')) proximo = proximo.nextElementSibling;
      const antesDeId = proximo && proximo.classList.contains('card') ? proximo.dataset.id : null;

      const id = arrastando;
      finalizarArraste();
      moverMateria(id, coluna.dataset.periodoId, antesDeId);
    });

    quadro.addEventListener('dragend', finalizarArraste);
  }

  /* ------------------------------------------------------------------ *
   * Ligações (pré-requisitos) direto no fluxograma
   * ------------------------------------------------------------------ */

  /** Torna `requisitoId` pré-requisito de `materiaId`, se não criar ciclo. */
  function ligarMaterias(requisitoId, materiaId) {
    const dados = App.estado.obter();
    const materia = dados.materias.find((m) => m.id === materiaId);
    if (!materia || requisitoId === materiaId) return;
    if (materia.preRequisitos.includes(requisitoId)) {
      toast('Essa ligação já existe.');
      return;
    }
    const ciclo = Modelo.cicloAoLigar(dados.materias, requisitoId, materiaId);
    if (ciclo) {
      toast(`Ligação não permitida: criaria uma dependência circular (${descreverCiclo(ciclo)}).`, 'erro', 7000);
      return;
    }
    App.estado.alterar('Ligar matérias', (rascunho) => {
      rascunho.materias.find((m) => m.id === materiaId).preRequisitos.push(requisitoId);
    });
  }

  async function removerLigacao(requisitoId, materiaId) {
    const confirmado = await App.ui.confirmar({
      titulo: 'Remover ligação?',
      mensagem: `"${nomeMateria(requisitoId)}" deixará de ser pré-requisito de "${nomeMateria(materiaId)}".`,
      confirmar: 'Remover',
      perigo: true,
    });
    if (!confirmado) return;
    App.estado.alterar('Remover ligação', (rascunho) => {
      const materia = rascunho.materias.find((m) => m.id === materiaId);
      if (materia) materia.preRequisitos = materia.preRequisitos.filter((p) => p !== requisitoId);
    });
  }

  /** Ligação em criação: { origemId, card } enquanto o usuário arrasta da bolinha. */
  let conexao = null;

  /** Card sob o ponteiro (exceto o de origem), candidato a receber a ligação. */
  function cardSobPonteiro(evento) {
    const alvo = document.elementFromPoint(evento.clientX, evento.clientY);
    const card = alvo && alvo.closest('.card');
    return card && card.dataset.id !== conexao.origemId ? card : null;
  }

  /** Rola o quadro quando o ponteiro chega perto das bordas. */
  function rolarNasBordas(evento) {
    const quadro = $('quadro');
    const r = quadro.getBoundingClientRect();
    const margem = 48;
    const passo = 18;
    if (evento.clientX > r.right - margem) quadro.scrollLeft += passo;
    else if (evento.clientX < r.left + margem) quadro.scrollLeft -= passo;
    if (evento.clientY > r.bottom - margem) quadro.scrollTop += passo;
    else if (evento.clientY < r.top + margem) quadro.scrollTop -= passo;
  }

  function atualizarConexao(evento) {
    rolarNasBordas(evento);
    const origem = conexao.card.getBoundingClientRect();
    const inicio = App.render.pontoNoConteudo(origem.right, origem.top + origem.height / 2);
    const fim = App.render.pontoNoConteudo(evento.clientX, evento.clientY);
    App.render.desenharLinhaTemporaria(inicio.x, inicio.y, fim.x, fim.y);

    const alvo = cardSobPonteiro(evento);
    document.querySelectorAll('.card.alvo-conexao').forEach((c) => c !== alvo && c.classList.remove('alvo-conexao'));
    if (alvo) alvo.classList.add('alvo-conexao');
  }

  function encerrarConexao() {
    conexao = null;
    document.body.classList.remove('modo-conexao');
    document.querySelectorAll('.card.alvo-conexao').forEach((c) => c.classList.remove('alvo-conexao'));
    App.render.limparLinhaTemporaria();
  }

  function ligarConexoes() {
    $('quadro').addEventListener('pointerdown', (evento) => {
      const conector = evento.target.closest('.conector');
      if (!conector || evento.button !== 0) return;
      evento.preventDefault(); // não inicia o arraste do card nem seleção de texto
      evento.stopPropagation();
      const card = conector.closest('.card');
      conexao = { origemId: card.dataset.id, card };
      conector.setPointerCapture(evento.pointerId);
      document.body.classList.add('modo-conexao');
      atualizarConexao(evento);
    });

    document.addEventListener('pointermove', (evento) => {
      if (conexao) atualizarConexao(evento);
    });

    document.addEventListener('pointerup', (evento) => {
      if (!conexao) return;
      const alvo = cardSobPonteiro(evento);
      const origemId = conexao.origemId;
      encerrarConexao();
      if (alvo) ligarMaterias(origemId, alvo.dataset.id);
    });

    document.addEventListener('pointercancel', () => conexao && encerrarConexao());
  }

  /* ------------------------------------------------------------------ *
   * Seleção e destaque de dependências
   * ------------------------------------------------------------------ */

  /** Matéria selecionada por clique (fica destacada até outro clique). */
  let selecionada = null;
  /** Matéria sob o mouse (o destaque temporário tem prioridade). */
  let sobMouse = null;

  const atualizarDestaque = () => App.render.aplicarDestaque(sobMouse || selecionada, selecionada);

  function selecionar(id) {
    selecionada = id;
    atualizarDestaque();
  }

  function ligarDestaque() {
    const quadro = $('quadro');

    quadro.addEventListener('pointerover', (evento) => {
      if (conexao || arrastando) return;
      const card = evento.target.closest('.card');
      const id = card ? card.dataset.id : null;
      if (id !== sobMouse) {
        sobMouse = id;
        atualizarDestaque();
      }
    });
    quadro.addEventListener('pointerleave', () => {
      sobMouse = null;
      atualizarDestaque();
    });

    // Clique no card seleciona (ou desmarca); clique no fundo limpa a seleção.
    quadro.addEventListener('click', (evento) => {
      if (evento.target.closest('button, .conector, .seta')) return;
      const card = evento.target.closest('.card');
      selecionar(card && card.dataset.id !== selecionada ? card.dataset.id : null);
    });

    // Após qualquer alteração, reaplica o destaque nos elementos redesenhados.
    App.estado.aoAlterar((dados) => {
      if (selecionada && !dados.materias.some((m) => m.id === selecionada)) selecionada = null;
      if (sobMouse && !dados.materias.some((m) => m.id === sobMouse)) sobMouse = null;
      atualizarDestaque();
    });
  }

  /* ------------------------------------------------------------------ *
   * Exportar / importar
   * ------------------------------------------------------------------ */

  async function exportarDados() {
    const resposta = await App.ipc.exportar(App.estado.obter());
    if (resposta.cancelado) return;
    if (resposta.ok) toast(`Dados exportados para ${resposta.caminho}`, 'sucesso', 6000);
    else toast('Não foi possível exportar: ' + resposta.erro, 'erro', 8000);
  }

  async function importarDados() {
    const resposta = await App.ipc.importar();
    if (resposta.cancelado) return;
    if (!resposta.ok) {
      toast('Não foi possível importar: ' + resposta.erro, 'erro', 8000);
      return;
    }

    const { materias, periodos } = resposta.dados;
    const confirmado = await App.ui.confirmar({
      titulo: 'Importar dados?',
      mensagem: `Os dados atuais serão substituídos pelos do arquivo (${materias.length} matéria(s) em ${periodos.length} período(s)).`,
      confirmar: 'Importar',
    });
    if (!confirmado) return;

    if (!App.estado.alterar('Importar dados', () => resposta.dados)) {
      toast('O arquivo contém os mesmos dados atuais; nada foi alterado.');
      return;
    }
    toast('Dados importados com sucesso.', 'sucesso');
    if (!App.estado.obter().configurado) abrirConfiguracao();
  }

  function ligarArquivos() {
    $('btn-exportar').addEventListener('click', exportarDados);
    $('btn-importar').addEventListener('click', importarDados);
    App.ipc.aoComandoDoMenu((comando) => {
      if (dialogoAberto()) return; // evita sobrepor diálogos
      if (comando === 'exportar') exportarDados();
      else if (comando === 'importar') importarDados();
    });
  }

  /* ------------------------------------------------------------------ *
   * Avisos de validação (não bloqueiam a ação)
   * ------------------------------------------------------------------ */

  /**
   * Após cada alteração, avisa se surgiu alguma matéria no mesmo período ou
   * antes de um de seus pré-requisitos. O card e a seta já ficam destacados;
   * o aviso só chama a atenção para o que acabou de acontecer.
   */
  function ligarAvisos() {
    let conflitosAnteriores = null; // null = primeira carga, não avisa
    App.estado.aoAlterar((dados) => {
      const atuais = Modelo.conflitosDePeriodo(dados);
      const chave = (c) => `${c.requisito}>${c.materia}`;
      if (conflitosAnteriores) {
        const novos = atuais.filter((c) => !conflitosAnteriores.has(chave(c)));
        if (novos.length) {
          const { requisito, materia } = novos[0];
          toast(
            `Atenção: "${nomeMateria(materia)}" está no mesmo período ou antes do seu pré-requisito "${nomeMateria(requisito)}".` +
              (novos.length > 1 ? ` (e mais ${novos.length - 1})` : ''),
            'aviso',
            6000,
          );
        }
      }
      conflitosAnteriores = new Set(atuais.map(chave));
    });
  }

  /* ------------------------------------------------------------------ *
   * Quadro: cliques e atalhos de teclado
   * ------------------------------------------------------------------ */

  /** Cliques no quadro são tratados por delegação, via atributos data-acao. */
  function ligarQuadro() {
    $('quadro').addEventListener('click', (evento) => {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      const { acao, periodoId, id, de, para } = alvo.dataset;
      if (acao === 'adicionar-periodo') adicionarPeriodo();
      else if (acao === 'remover-periodo') removerPeriodo(periodoId);
      else if (acao === 'nova-materia') abrirFormularioMateria(null, periodoId);
      else if (acao === 'editar-materia') abrirFormularioMateria(id);
      else if (acao === 'excluir-materia') excluirMateria(id);
      else if (acao === 'remover-ligacao') removerLigacao(de, para);
    });

    // Duplo clique no card abre a edição.
    $('quadro').addEventListener('dblclick', (evento) => {
      const card = evento.target.closest('.card');
      if (card && !evento.target.closest('button')) abrirFormularioMateria(card.dataset.id);
    });

    // Teclado: Enter edita e Delete exclui o card em foco.
    $('quadro').addEventListener('keydown', (evento) => {
      const card = evento.target.closest('.card');
      if (!card || evento.target !== card) return;
      if (evento.key !== 'Enter' && evento.key !== 'Delete') return;
      // Impede que o Enter "vaze" para o formulário recém-aberto e o envie.
      evento.preventDefault();
      if (evento.key === 'Enter') abrirFormularioMateria(card.dataset.id);
      else excluirMateria(card.dataset.id);
    });
  }

  /** Há algum diálogo aberto? (atalhos globais ficam desativados) */
  const dialogoAberto = () => !!document.querySelector('dialog[open]');

  function ligarAtalhos() {
    document.addEventListener('keydown', (evento) => {
      if (dialogoAberto()) return;
      if (evento.key === 'Escape' && selecionada) {
        selecionar(null);
        return;
      }
      const ctrl = evento.ctrlKey || evento.metaKey;
      if (ctrl && !evento.shiftKey && evento.key.toLowerCase() === 'n') {
        evento.preventDefault();
        abrirFormularioMateria();
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Inicialização
   * ------------------------------------------------------------------ */

  /** Exibe um erro que impede o uso do app (os dados não são tocados). */
  function mostrarErroFatal(mensagem) {
    $('quadro').replaceChildren(
      el('div', { class: 'vazio' }, [
        el('p', { class: 'vazio-titulo' }, 'Não foi possível abrir os dados do curso.'),
        el('p', {}, mensagem),
      ]),
    );
  }

  async function iniciar() {
    App.ui.aplicarIcones();
    let resposta;
    try {
      resposta = await App.ipc.carregar();
    } catch (erro) {
      mostrarErroFatal(erro.message);
      return;
    }
    // A renderização é registrada primeiro: os demais ouvintes de mudança
    // (ex.: destaque) trabalham sobre os elementos já redesenhados.
    App.estado.aoAlterar(App.render.renderizar);
    ligarConfiguracao();
    ligarQuadro();
    ligarFormularioMateria();
    ligarReprovacao();
    ligarArrastarCards();
    ligarConexoes();
    ligarDestaque();
    ligarAvisos();
    ligarArquivos();
    ligarAtalhos();

    // As setas dependem da posição dos cards: redesenha quando o layout muda
    // (janela redimensionada, zoom, fontes carregadas...).
    let quadroPendente = 0;
    const agendarSetas = () => {
      cancelAnimationFrame(quadroPendente);
      quadroPendente = requestAnimationFrame(() => {
        App.render.desenharSetas();
        atualizarDestaque();
      });
    };
    window.addEventListener('resize', agendarSetas);
    new ResizeObserver(agendarSetas).observe($('quadro'));
    App.estado.iniciar(resposta.dados);
    if (resposta.aviso) toast(resposta.aviso, 'aviso', 10000);
    if (!resposta.dados.configurado) abrirConfiguracao();
  }

  iniciar();
})();
