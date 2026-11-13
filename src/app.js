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
    App.estado.aoAlterar(App.render.renderizar);
    App.estado.iniciar(resposta.dados);
    if (resposta.aviso) toast(resposta.aviso, 'aviso', 10000);
    if (!resposta.dados.configurado) abrirConfiguracao();
  }

  iniciar();
})();
