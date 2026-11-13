/**
 * Modelo de dados do curso — compartilhado entre o processo principal (Node.js)
 * e a interface (navegador). Não depende de nenhuma API específica de ambiente.
 *
 * Estrutura do arquivo curso.json:
 * {
 *   versao: 1,
 *   configurado: boolean,      // false até o usuário informar os períodos
 *   periodosBase: number,      // períodos previstos pelo curso
 *   periodos: [{ id }],        // ordem = ordem das colunas; índice >= periodosBase é "extra"
 *   materias: []
 * }
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Modelo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSAO_DADOS = 1;
  const LIMITE_PERIODOS_BASE = 20;
  const LIMITE_PERIODOS = 40;
  const PERIODOS_PADRAO = 8;

  /** Gera um identificador único curto (ex.: "p-lk2j3h-8f2a1c"). */
  function gerarId(prefixo) {
    const aleatorio = Math.random().toString(36).slice(2, 8);
    return `${prefixo}-${Date.now().toString(36)}-${aleatorio}`;
  }

  /** Dados de um curso ainda não configurado (primeira execução). */
  function criarDadosPadrao() {
    return {
      versao: VERSAO_DADOS,
      configurado: false,
      periodosBase: PERIODOS_PADRAO,
      periodos: [],
      materias: [],
    };
  }

  const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const ehInteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

  /**
   * Completa campos ausentes com valores padrão e descarta campos desconhecidos,
   * para aceitar arquivos de versões anteriores do app. Lança erro se a
   * estrutura básica for irreconhecível.
   */
  function normalizarDados(bruto) {
    if (!ehObjeto(bruto)) throw new Error('O conteúdo não é um objeto de dados do curso.');
    const padrao = criarDadosPadrao();
    return {
      versao: VERSAO_DADOS,
      configurado: typeof bruto.configurado === 'boolean' ? bruto.configurado : padrao.configurado,
      periodosBase: bruto.periodosBase ?? padrao.periodosBase,
      periodos: Array.isArray(bruto.periodos)
        ? bruto.periodos.map((p) => (ehObjeto(p) ? { id: p.id } : p))
        : padrao.periodos,
      materias: Array.isArray(bruto.materias) ? bruto.materias : padrao.materias,
    };
  }

  /**
   * Verifica a consistência completa dos dados.
   * @returns {{ok: boolean, erros: string[]}}
   */
  function validarDados(dados) {
    const erros = [];
    const erro = (msg) => erros.length < 10 && erros.push(msg);

    if (!ehObjeto(dados)) return { ok: false, erros: ['Os dados não são um objeto.'] };
    if (dados.versao !== VERSAO_DADOS) erro(`Versão de dados não suportada: ${dados.versao}.`);
    if (typeof dados.configurado !== 'boolean') erro('Campo "configurado" inválido.');
    if (!ehInteiro(dados.periodosBase, 1, LIMITE_PERIODOS_BASE)) {
      erro(`O número de períodos previstos deve estar entre 1 e ${LIMITE_PERIODOS_BASE}.`);
    }

    // Períodos
    if (!Array.isArray(dados.periodos)) {
      erro('Lista de períodos ausente.');
    } else {
      if (dados.periodos.length > LIMITE_PERIODOS) erro(`Máximo de ${LIMITE_PERIODOS} períodos.`);
      if (dados.configurado && dados.periodos.length === 0) erro('O curso precisa de ao menos um período.');
      const ids = new Set();
      dados.periodos.forEach((p, i) => {
        if (!ehObjeto(p) || typeof p.id !== 'string' || !p.id) erro(`Período ${i + 1} sem identificador.`);
        else if (ids.has(p.id)) erro(`Identificador de período repetido: ${p.id}.`);
        else ids.add(p.id);
      });
    }

    // Matérias
    if (!Array.isArray(dados.materias)) erro('Lista de matérias ausente.');

    return { ok: erros.length === 0, erros };
  }

  /** Rótulo de exibição de um período a partir do índice (0 → "1º período"). */
  function rotuloPeriodo(indice) {
    return `${indice + 1}º período`;
  }

  return {
    VERSAO_DADOS,
    LIMITE_PERIODOS_BASE,
    LIMITE_PERIODOS,
    PERIODOS_PADRAO,
    gerarId,
    criarDadosPadrao,
    normalizarDados,
    validarDados,
    rotuloPeriodo,
  };
});
