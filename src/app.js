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
    $('materia-erro').hidden = true;

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

    return {
      valores: {
        nome,
        codigo: $('materia-codigo').value.trim(),
        cargaHoraria,
        periodoId: $('materia-periodo').value,
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
    if (materiaEmEdicao) {
      const id = materiaEmEdicao;
      aplicado = App.estado.alterar('Editar matéria', (rascunho) => {
        Object.assign(rascunho.materias.find((m) => m.id === id), valores);
      });
    } else {
      aplicado = App.estado.alterar('Adicionar matéria', (rascunho) => {
        rascunho.materias.push(Modelo.criarMateria(valores));
      });
    }
    // Editar sem mudar nada também fecha o formulário.
    if (aplicado || materiaEmEdicao) $('dlg-materia').close();
  }

  function ligarFormularioMateria() {
    $('btn-nova-materia').addEventListener('click', () => abrirFormularioMateria());
    $('form-materia').addEventListener('submit', salvarMateria);
    $('materia-cancelar').addEventListener('click', () => $('dlg-materia').close());
  }

  /* ------------------------------------------------------------------ *
   * Quadro: cliques e atalhos de teclado
   * ------------------------------------------------------------------ */

  /** Cliques no quadro são tratados por delegação, via atributos data-acao. */
  function ligarQuadro() {
    $('quadro').addEventListener('click', (evento) => {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      const { acao, periodoId } = alvo.dataset;
      if (acao === 'adicionar-periodo') adicionarPeriodo();
      else if (acao === 'remover-periodo') removerPeriodo(periodoId);
      else if (acao === 'nova-materia') abrirFormularioMateria(null, periodoId);
    });
  }

  /** Há algum diálogo aberto? (atalhos globais ficam desativados) */
  const dialogoAberto = () => !!document.querySelector('dialog[open]');

  function ligarAtalhos() {
    document.addEventListener('keydown', (evento) => {
      if (dialogoAberto()) return;
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
    ligarConfiguracao();
    ligarQuadro();
    ligarFormularioMateria();
    ligarAtalhos();
    App.estado.aoAlterar(App.render.renderizar);
    App.estado.iniciar(resposta.dados);
    if (resposta.aviso) toast(resposta.aviso, 'aviso', 10000);
    if (!resposta.dados.configurado) abrirConfiguracao();
  }

  iniciar();
})();
