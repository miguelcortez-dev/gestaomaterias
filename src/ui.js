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

  App.ui = { el, toast };
})();
