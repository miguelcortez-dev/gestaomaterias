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
 *   materias: [{
 *     id, nome,
 *     codigo: string,          // opcional ('' quando vazio)
 *     cargaHoraria: number|null,
 *     periodoId,               // período em que será cursada
 *     preRequisitos: [id],     // matérias que precisam ser cursadas antes
 *     status                   // um de STATUS
 *   }]                     // a ordem do array define a ordem dos cards em cada coluna
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
  const LIMITE_NOME = 120;
  const LIMITE_CODIGO = 20;
  const LIMITE_CARGA_HORARIA = 2000;
  const STATUS = ['Pendente', 'Cursando', 'Aprovada', 'Reprovada'];
  const STATUS_PADRAO = 'Pendente';

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

  /** Cria uma matéria nova com os valores padrão para os campos não informados. */
  function criarMateria(campos) {
    return {
      id: gerarId('m'),
      nome: '',
      codigo: '',
      cargaHoraria: null,
      periodoId: null,
      preRequisitos: [],
      status: STATUS_PADRAO,
      ...campos,
    };
  }

  const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const ehInteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

  /** Completa os campos de uma matéria (formato de versões anteriores). */
  function normalizarMateria(m) {
    if (!ehObjeto(m)) return m;
    return {
      id: m.id,
      nome: typeof m.nome === 'string' ? m.nome.trim() : m.nome,
      codigo: m.codigo === undefined || m.codigo === null ? '' : typeof m.codigo === 'string' ? m.codigo.trim() : m.codigo,
      cargaHoraria: m.cargaHoraria === undefined || m.cargaHoraria === '' ? null : m.cargaHoraria,
      periodoId: m.periodoId,
      preRequisitos: m.preRequisitos === undefined
        ? []
        : Array.isArray(m.preRequisitos) ? [...new Set(m.preRequisitos)] : m.preRequisitos,
      status: m.status === undefined ? STATUS_PADRAO : m.status,
    };
  }

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
      materias: Array.isArray(bruto.materias) ? bruto.materias.map(normalizarMateria) : padrao.materias,
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
    const idsPeriodos = new Set();
    if (!Array.isArray(dados.periodos)) {
      erro('Lista de períodos ausente.');
    } else {
      if (dados.periodos.length > LIMITE_PERIODOS) erro(`Máximo de ${LIMITE_PERIODOS} períodos.`);
      if (dados.configurado && dados.periodos.length === 0) erro('O curso precisa de ao menos um período.');
      dados.periodos.forEach((p, i) => {
        if (!ehObjeto(p) || typeof p.id !== 'string' || !p.id) erro(`Período ${i + 1} sem identificador.`);
        else if (idsPeriodos.has(p.id)) erro(`Identificador de período repetido: ${p.id}.`);
        else idsPeriodos.add(p.id);
      });
    }

    // Matérias
    if (!Array.isArray(dados.materias)) {
      erro('Lista de matérias ausente.');
      return { ok: false, erros };
    }
    const idsMaterias = new Set();
    dados.materias.forEach((m, i) => {
      if (!ehObjeto(m)) {
        erro(`Matéria ${i + 1}: formato inválido.`);
        return;
      }
      const ref = typeof m.nome === 'string' && m.nome ? `Matéria "${m.nome}"` : `Matéria ${i + 1}`;
      if (typeof m.id !== 'string' || !m.id) erro(`${ref}: sem identificador.`);
      else if (idsMaterias.has(m.id)) erro(`${ref}: identificador repetido.`);
      else idsMaterias.add(m.id);
      if (typeof m.nome !== 'string' || !m.nome.trim()) erro(`${ref}: o nome é obrigatório.`);
      else if (m.nome.length > LIMITE_NOME) erro(`${ref}: nome com mais de ${LIMITE_NOME} caracteres.`);
      if (typeof m.codigo !== 'string' || m.codigo.length > LIMITE_CODIGO) {
        erro(`${ref}: o código deve ter até ${LIMITE_CODIGO} caracteres.`);
      }
      if (m.cargaHoraria !== null && !ehInteiro(m.cargaHoraria, 0, LIMITE_CARGA_HORARIA)) {
        erro(`${ref}: a carga horária deve ser um número inteiro entre 0 e ${LIMITE_CARGA_HORARIA}.`);
      }
      if (!idsPeriodos.has(m.periodoId)) erro(`${ref}: período inexistente.`);
      if (!STATUS.includes(m.status)) erro(`${ref}: status inválido.`);
    });

    // Pré-requisitos: devem apontar para matérias existentes e não formar ciclos.
    let ligacoesValidas = true;
    dados.materias.forEach((m, i) => {
      if (!ehObjeto(m)) return;
      const ref = typeof m.nome === 'string' && m.nome ? `Matéria "${m.nome}"` : `Matéria ${i + 1}`;
      if (!Array.isArray(m.preRequisitos)) {
        erro(`${ref}: lista de pré-requisitos inválida.`);
        ligacoesValidas = false;
        return;
      }
      if (new Set(m.preRequisitos).size !== m.preRequisitos.length) erro(`${ref}: pré-requisito repetido.`);
      for (const id of m.preRequisitos) {
        if (id === m.id) {
          erro(`${ref}: uma matéria não pode ser pré-requisito de si mesma.`);
          ligacoesValidas = false;
        } else if (!idsMaterias.has(id)) {
          erro(`${ref}: pré-requisito inexistente.`);
          ligacoesValidas = false;
        }
      }
    });
    if (ligacoesValidas && temCiclo(dados.materias)) erro('Há dependências circulares entre as matérias.');

    return { ok: erros.length === 0, erros };
  }

  /* ------------------------------------------------------------------ *
   * Grafo de dependências
   * Uma seta vai do pré-requisito para a matéria que depende dele.
   * ------------------------------------------------------------------ */

  const indexar = (materias) => new Map(materias.map((m) => [m.id, m]));

  /** Mapa id → ids das matérias que têm `id` como pré-requisito direto. */
  function mapaDeDependentes(materias) {
    const mapa = new Map();
    for (const m of materias) {
      for (const p of m.preRequisitos) {
        if (!mapa.has(p)) mapa.set(p, []);
        mapa.get(p).push(m.id);
      }
    }
    return mapa;
  }

  /** Percorre o grafo a partir dos vizinhos de `id` e devolve todos os alcançados. */
  function alcancaveis(id, vizinhos) {
    const resultado = new Set();
    const pilha = [...vizinhos(id)];
    while (pilha.length) {
      const atual = pilha.pop();
      if (resultado.has(atual) || atual === id) continue;
      resultado.add(atual);
      pilha.push(...vizinhos(atual));
    }
    return resultado;
  }

  /** Tudo o que a matéria exige, direta ou indiretamente. */
  function requisitosDe(materias, id) {
    const mapa = indexar(materias);
    return alcancaveis(id, (atual) => (mapa.get(atual) ? mapa.get(atual).preRequisitos : []));
  }

  /** Tudo o que a matéria libera (matérias que dependem dela, direta ou indiretamente). */
  function liberadasPor(materias, id) {
    const dependentes = mapaDeDependentes(materias);
    return alcancaveis(id, (atual) => dependentes.get(atual) || []);
  }

  /**
   * Caminho de pré-requisitos de `de` até `ate` (de exige … que exige ate),
   * como lista de ids, ou null se não existir.
   */
  function caminhoDeRequisitos(materias, de, ate) {
    const mapa = indexar(materias);
    const anterior = new Map([[de, null]]);
    const fila = [de];
    while (fila.length) {
      const atual = fila.shift();
      if (atual === ate) {
        const caminho = [];
        for (let n = ate; n !== null; n = anterior.get(n)) caminho.unshift(n);
        return caminho;
      }
      for (const p of (mapa.get(atual) ? mapa.get(atual).preRequisitos : [])) {
        if (!anterior.has(p)) {
          anterior.set(p, atual);
          fila.push(p);
        }
      }
    }
    return null;
  }

  /**
   * Verifica se tornar `requisitoId` pré-requisito de `materiaId` criaria um ciclo.
   * @returns {string[]|null} ids do ciclo na ordem das setas (ex.: [A, B, A]), ou null.
   */
  function cicloAoLigar(materias, requisitoId, materiaId) {
    if (requisitoId === materiaId) return [materiaId, materiaId];
    // Há ciclo se o futuro pré-requisito já depende (indiretamente) da matéria.
    const caminho = caminhoDeRequisitos(materias, requisitoId, materiaId);
    return caminho ? [...caminho.reverse(), materiaId] : null;
  }

  /** Detecta qualquer ciclo no grafo (busca em profundidade com três cores). */
  function temCiclo(materias) {
    const mapa = indexar(materias);
    const cor = new Map(); // ausente = não visitado, 1 = em visita, 2 = concluído
    const visitar = (id) => {
      cor.set(id, 1);
      for (const p of mapa.get(id).preRequisitos) {
        if (!mapa.has(p)) continue;
        if (cor.get(p) === 1) return true;
        if (!cor.has(p) && visitar(p)) return true;
      }
      cor.set(id, 2);
      return false;
    };
    return materias.some((m) => !cor.has(m.id) && visitar(m.id));
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
    LIMITE_NOME,
    LIMITE_CODIGO,
    LIMITE_CARGA_HORARIA,
    STATUS,
    gerarId,
    criarDadosPadrao,
    criarMateria,
    normalizarDados,
    validarDados,
    requisitosDe,
    liberadasPor,
    cicloAoLigar,
    temCiclo,
    rotuloPeriodo,
  };
});
