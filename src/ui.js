/**
 * Utilitários de interface: criação de elementos e mensagens (toasts).
 * Todo texto vindo do usuário é inserido com textContent, nunca como HTML.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  /**
   * Cria um elemento HTML.
   * @param {string} tag
   * @param {object} [atributos]  `class`, `dataset`, `on*` (eventos) e demais atributos
   * @param {Array|string|Node} [filhos]
   */
  function el(tag, atributos = {}, filhos = []) {
    const elemento = document.createElement(tag);
    for (const [nome, valor] of Object.entries(atributos)) {
      if (valor === undefined || valor === null || valor === false) continue;
      if (nome === 'class') elemento.className = valor;
      else if (nome === 'dataset') Object.assign(elemento.dataset, valor);
      else if (nome.startsWith('on')) elemento.addEventListener(nome.slice(2), valor);
      else if (valor === true) elemento.setAttribute(nome, '');
      else elemento.setAttribute(nome, String(valor));
    }
    for (const filho of [].concat(filhos)) {
      if (filho === null || filho === undefined || filho === false) continue;
      elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
    }
    return elemento;
  }

  /**
   * Mostra uma mensagem temporária no rodapé.
   * @param {string} mensagem
   * @param {'info'|'sucesso'|'aviso'|'erro'} [tipo]
   * @param {number} [duracao] em milissegundos
   */
  function toast(mensagem, tipo = 'info', duracao = 4000) {
    const area = document.getElementById('toasts');
    const item = el('div', { class: `toast toast-${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' }, mensagem);
    area.append(item);
    setTimeout(() => {
      item.classList.add('saindo');
      setTimeout(() => item.remove(), 250);
    }, duracao);
  }

  /* ---------- Ícones (SVG em linha, traço na cor do texto) ---------- */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONES = {
    mais: 'M12 5v14M5 12h14',
    ajustes: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    fechar: 'M18 6 6 18M6 6l12 12',
    editar: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
    excluir: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
    alerta: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
    desfazer: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    refazer: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
    exportar: 'M12 3v12m-5-5 5 5 5-5M5 21h14',
    importar: 'M12 21V9m-5 5 5-5 5 5M5 3h14',
    sol: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
    lua: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z',
  };

  /** Cria um ícone SVG pelo nome (ver ICONES). */
  function icone(nome) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('icone');
    const caminho = document.createElementNS(SVG_NS, 'path');
    caminho.setAttribute('d', ICONES[nome] || '');
    svg.append(caminho);
    return svg;
  }

  /** Insere os ícones dos elementos estáticos marcados com data-icone. */
  function aplicarIcones(raiz = document) {
    raiz.querySelectorAll('[data-icone]').forEach((alvo) => {
      if (!alvo.querySelector(':scope > svg.icone')) alvo.prepend(icone(alvo.dataset.icone));
    });
  }

  /* ---------- Confirmação ---------- */

  /**
   * Pede confirmação ao usuário com um diálogo próprio do app.
   * @param {{titulo: string, mensagem: string, confirmar?: string, cancelar?: string, perigo?: boolean}} opcoes
   * @returns {Promise<boolean>}
   */
  function confirmar({ titulo, mensagem, confirmar: textoSim = 'Confirmar', cancelar = 'Cancelar', perigo = false }) {
    const dialogo = document.getElementById('dlg-confirmar');
    const form = document.getElementById('form-confirmar');
    const sim = document.getElementById('confirmar-sim');
    const nao = document.getElementById('confirmar-nao');

    document.getElementById('confirmar-titulo').textContent = titulo;
    document.getElementById('confirmar-mensagem').textContent = mensagem;
    sim.textContent = textoSim;
    nao.textContent = cancelar;
    sim.className = 'btn ' + (perigo ? 'btn-perigo' : 'btn-primario');

    return new Promise((resolver) => {
      const responder = (valor) => {
        form.onsubmit = nao.onclick = dialogo.oncancel = null;
        dialogo.close();
        resolver(valor);
      };
      form.onsubmit = (evento) => {
        evento.preventDefault();
        responder(true);
      };
      nao.onclick = () => responder(false);
      dialogo.oncancel = (evento) => {
        evento.preventDefault();
        responder(false);
      };
      dialogo.showModal();
      (perigo ? nao : sim).focus(); // em ações destrutivas, o foco fica em "Cancelar"
    });
  }

  App.ui = { el, toast, icone, aplicarIcones, confirmar };
})();
