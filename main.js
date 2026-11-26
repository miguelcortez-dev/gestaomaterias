'use strict';
/**
 * Processo principal do Electron.
 *
 * Responsabilidades:
 *  - criar a janela principal (instância única, lembrando tamanho e posição);
 *  - montar o menu em português;
 *  - aplicar e lembrar o tema escolhido (sistema, claro ou escuro);
 *  - aplicar as regras de segurança (sem navegação externa, sem permissões);
 *  - ler e gravar os dados do curso em disco, atendendo à interface via IPC.
 */
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, screen, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = fs.promises;
const Modelo = require('./src/modelo.js');

const ARQUIVO_DADOS = 'curso.json';
const ARQUIVO_JANELA = 'janela.json';
const ARQUIVO_PREFERENCIAS = 'preferencias.json';
const TAMANHO_PADRAO = { width: 1280, height: 800 };
const TAMANHO_MINIMO = { width: 960, height: 600 };

/** Janela principal (única) do aplicativo. */
let janelaPrincipal = null;

/* ------------------------------------------------------------------ *
 * Persistência dos dados (curso.json na pasta de dados do usuário)
 * ------------------------------------------------------------------ */

function caminhoDados() {
  return path.join(app.getPath('userData'), ARQUIVO_DADOS);
}

/** Lê, normaliza e valida um arquivo de dados. Lança erro se for inválido. */
async function lerArquivoDeDados(caminho, { exigirEstrutura = false } = {}) {
  const texto = await fsp.readFile(caminho, 'utf8');
  const bruto = JSON.parse(texto);
  // Na importação, um JSON qualquer não pode virar um curso vazio "válido".
  if (exigirEstrutura && !(bruto && Array.isArray(bruto.periodos) && Array.isArray(bruto.materias))) {
    throw new Error('O arquivo não parece conter dados exportados pelo Gestão de Matérias.');
  }
  const dados = Modelo.normalizarDados(bruto);
  const validacao = Modelo.validarDados(dados);
  if (!validacao.ok) throw new Error(validacao.erros.join(' '));
  return dados;
}

/** No Windows, antivírus/indexadores podem travar o arquivo por instantes. */
async function renomearComRetentativa(origem, destino) {
  for (let tentativa = 0; ; tentativa++) {
    try {
      await fsp.rename(origem, destino);
      return;
    } catch (erro) {
      if (tentativa >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(erro.code)) throw erro;
      await new Promise((resolver) => setTimeout(resolver, 50 * (tentativa + 1)));
    }
  }
}

/**
 * Gravação atômica: valida, escreve em um arquivo temporário, guarda a versão
 * anterior em curso.json.bak e só então substitui o arquivo principal por
 * renomeação. Uma queda no meio do processo nunca deixa o curso.json pela metade.
 */
async function gravarAtomico(dados) {
  const validacao = Modelo.validarDados(dados);
  if (!validacao.ok) throw new Error('Dados inválidos: ' + validacao.erros.join(' '));

  const texto = JSON.stringify(dados, null, 2);
  JSON.parse(texto); // confirma que o conteúdo serializado é um JSON válido

  const destino = caminhoDados();
  const temporario = `${destino}.tmp`;
  await fsp.mkdir(path.dirname(destino), { recursive: true });

  const arquivo = await fsp.open(temporario, 'w');
  try {
    await arquivo.writeFile(texto, 'utf8');
    await arquivo.sync(); // garante que os bytes chegaram ao disco
  } finally {
    await arquivo.close();
  }

  try {
    await fsp.copyFile(destino, `${destino}.bak`);
  } catch (erro) {
    if (erro.code !== 'ENOENT') throw erro; // primeira gravação: ainda não há o que copiar
  }
  await renomearComRetentativa(temporario, destino);
}

// Fila de gravação: garante que gravações simultâneas aconteçam em ordem.
let filaDeGravacao = Promise.resolve();
function salvarDados(dados) {
  const tarefa = filaDeGravacao.then(() => gravarAtomico(dados));
  filaDeGravacao = tarefa.catch(() => {});
  return tarefa;
}

/**
 * Carrega os dados. Na primeira execução cria o arquivo; se ele estiver
 * corrompido, preserva uma cópia e tenta restaurar a partir do .bak.
 */
async function carregarDados() {
  const arquivo = caminhoDados();
  try {
    return { dados: await lerArquivoDeDados(arquivo) };
  } catch (erro) {
    if (erro.code === 'ENOENT') {
      const dados = Modelo.criarDadosPadrao();
      await salvarDados(dados);
      return { dados, primeiraExecucao: true };
    }

    console.error('Arquivo de dados inválido:', erro.message);
    const preservado = `${arquivo}.corrompido-${Date.now()}`;
    await fsp.rename(arquivo, preservado).catch(() => {});

    try {
      const dados = await lerArquivoDeDados(`${arquivo}.bak`);
      await salvarDados(dados);
      return {
        dados,
        aviso: 'O arquivo de dados estava danificado e foi restaurado a partir da cópia de segurança.',
      };
    } catch {
      const dados = Modelo.criarDadosPadrao();
      await salvarDados(dados);
      return {
        dados,
        aviso: `Não foi possível ler os dados salvos. Uma cópia do arquivo danificado foi guardada em: ${preservado}`,
      };
    }
  }
}

/* ------------------------------------------------------------------ *
 * IPC (comunicação com a interface)
 * ------------------------------------------------------------------ */

/** Aceita mensagens apenas do quadro principal da nossa própria janela. */
function validarRemetente(evento) {
  const quadro = evento.senderFrame;
  const valido = janelaPrincipal &&
    evento.sender === janelaPrincipal.webContents &&
    quadro && quadro.parent === null &&
    quadro.url.startsWith('file:');
  if (!valido) throw new Error('Remetente não autorizado.');
}

function registrarIpc() {
  ipcMain.handle('dados:carregar', async (evento) => {
    validarRemetente(evento);
    return carregarDados();
  });

  ipcMain.handle('dados:salvar', async (evento, dados) => {
    validarRemetente(evento);
    try {
      await salvarDados(dados);
      return { ok: true };
    } catch (erro) {
      console.error('Falha ao salvar:', erro);
      return { ok: false, erro: erro.message };
    }
  });

  ipcMain.handle('dados:exportar', async (evento, dados) => {
    validarRemetente(evento);
    return exportarDados(dados);
  });

  ipcMain.handle('dados:importar', async (evento) => {
    validarRemetente(evento);
    return importarDados();
  });

  ipcMain.handle('tema:obter', (evento) => {
    validarRemetente(evento);
    return estadoDoTema();
  });

  ipcMain.handle('tema:definir', (evento, tema) => {
    validarRemetente(evento);
    if (typeof tema !== 'string' || !Object.hasOwn(TEMAS, tema)) return { ok: false, erro: 'Tema desconhecido.' };
    definirTema(tema);
    return { ok: true, ...estadoDoTema() };
  });
}

/** Envia um comando do menu para a interface (ex.: "exportar"). */
function enviarComandoDoMenu(comando) {
  if (janelaPrincipal) janelaPrincipal.webContents.send('menu:comando', comando);
}

/* ------------------------------------------------------------------ *
 * Exportar / importar (diálogos nativos de arquivo)
 * ------------------------------------------------------------------ */

const TAMANHO_MAXIMO_IMPORTACAO = 5 * 1024 * 1024; // 5 MB
const FILTRO_JSON = [{ name: 'Arquivo JSON', extensions: ['json'] }];

/** Pede um destino ao usuário e grava uma cópia dos dados em JSON. */
async function exportarDados(dados) {
  const validacao = Modelo.validarDados(dados);
  if (!validacao.ok) return { ok: false, erro: validacao.erros.join(' ') };

  const hoje = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD
  const { canceled, filePath } = await dialog.showSaveDialog(janelaPrincipal, {
    title: 'Exportar dados do curso',
    defaultPath: path.join(app.getPath('documents'), `curso-${hoje}.json`),
    buttonLabel: 'Exportar',
    filters: FILTRO_JSON,
  });
  if (canceled || !filePath) return { ok: false, cancelado: true };

  try {
    await fsp.writeFile(filePath, JSON.stringify(dados, null, 2), 'utf8');
    return { ok: true, caminho: filePath };
  } catch (erro) {
    return { ok: false, erro: `Não foi possível gravar o arquivo: ${erro.message}` };
  }
}

/** Pede um arquivo ao usuário, lê e valida. Não altera os dados atuais. */
async function importarDados() {
  const { canceled, filePaths } = await dialog.showOpenDialog(janelaPrincipal, {
    title: 'Importar dados do curso',
    buttonLabel: 'Importar',
    properties: ['openFile'],
    filters: FILTRO_JSON,
  });
  if (canceled || !filePaths || !filePaths.length) return { ok: false, cancelado: true };

  const caminho = filePaths[0];
  try {
    const { size } = await fsp.stat(caminho);
    if (size > TAMANHO_MAXIMO_IMPORTACAO) throw new Error('O arquivo é grande demais (máximo de 5 MB).');
    return { ok: true, dados: await lerArquivoDeDados(caminho, { exigirEstrutura: true }), caminho };
  } catch (erro) {
    const mensagem = erro instanceof SyntaxError ? 'O arquivo não contém um JSON válido.' : erro.message;
    return { ok: false, erro: mensagem };
  }
}

/* ------------------------------------------------------------------ *
 * Tema (sistema, claro ou escuro)
 * ------------------------------------------------------------------ */

/** Temas aceitos e o valor correspondente de nativeTheme.themeSource. */
const TEMAS = { sistema: 'system', claro: 'light', escuro: 'dark' };
const TEMA_PADRAO = 'sistema';
const COR_FUNDO = { claro: '#f3f5f9', escuro: '#12161d' }; // igual a --cor-fundo do style.css

let temaAtual = TEMA_PADRAO;

function caminhoPreferencias() {
  return path.join(app.getPath('userData'), ARQUIVO_PREFERENCIAS);
}

/** Lê o tema salvo; qualquer problema no arquivo volta ao padrão (seguir o sistema). */
function lerTemaSalvo() {
  try {
    const { tema } = JSON.parse(fs.readFileSync(caminhoPreferencias(), 'utf8'));
    return Object.hasOwn(TEMAS, tema) ? tema : TEMA_PADRAO;
  } catch {
    return TEMA_PADRAO;
  }
}

function salvarTema(tema) {
  try {
    fs.mkdirSync(path.dirname(caminhoPreferencias()), { recursive: true });
    fs.writeFileSync(caminhoPreferencias(), JSON.stringify({ tema }));
  } catch (erro) {
    console.error('Não foi possível salvar o tema:', erro);
  }
}

/** Tema escolhido e se, na prática, as cores escuras estão em uso. */
function estadoDoTema() {
  return { tema: temaAtual, escuro: nativeTheme.shouldUseDarkColors };
}

/**
 * Aplica o tema. O nativeTheme define o prefers-color-scheme da interface e
 * também a aparência dos diálogos nativos e da barra de título.
 */
function aplicarTema(tema) {
  temaAtual = Object.hasOwn(TEMAS, tema) ? tema : TEMA_PADRAO;
  nativeTheme.themeSource = TEMAS[temaAtual];
}

/** Troca o tema a pedido do usuário (menu ou botão), grava e atualiza o menu. */
function definirTema(tema) {
  if (!Object.hasOwn(TEMAS, tema)) return;
  const mudou = tema !== temaAtual;
  aplicarTema(tema);
  if (!mudou) return;
  salvarTema(temaAtual);
  montarMenu(); // mantém marcada a opção certa em Exibir › Tema
}

/** Avisa a interface sempre que as cores efetivas mudam (inclusive pelo sistema). */
function acompanharTema() {
  nativeTheme.on('updated', () => {
    if (!janelaPrincipal) return;
    const { escuro } = estadoDoTema();
    janelaPrincipal.setBackgroundColor(escuro ? COR_FUNDO.escuro : COR_FUNDO.claro);
    janelaPrincipal.webContents.send('tema:alterado', estadoDoTema());
  });
}

/* ------------------------------------------------------------------ *
 * Janela principal
 * ------------------------------------------------------------------ */

function caminhoEstadoJanela() {
  return path.join(app.getPath('userData'), ARQUIVO_JANELA);
}

/**
 * Lê o tamanho/posição salvos da última sessão. Descarta a posição se ela
 * estiver fora de todos os monitores atuais (ex.: monitor externo desconectado).
 */
function lerEstadoJanela() {
  try {
    const salvo = JSON.parse(fs.readFileSync(caminhoEstadoJanela(), 'utf8'));
    if (!['x', 'y', 'width', 'height'].every((k) => Number.isFinite(salvo[k]))) return { ...TAMANHO_PADRAO };

    const estado = {
      width: Math.max(Math.round(salvo.width), TAMANHO_MINIMO.width),
      height: Math.max(Math.round(salvo.height), TAMANHO_MINIMO.height),
      maximizado: salvo.maximizado === true,
    };
    const visivel = screen.getAllDisplays().some(({ workArea: a }) =>
      salvo.x < a.x + a.width - 80 &&
      salvo.x + salvo.width > a.x + 80 &&
      salvo.y >= a.y - 20 &&
      salvo.y < a.y + a.height - 80);
    if (visivel) {
      estado.x = Math.round(salvo.x);
      estado.y = Math.round(salvo.y);
    }
    return estado;
  } catch {
    return { ...TAMANHO_PADRAO };
  }
}

function salvarEstadoJanela(estado) {
  if (!estado) return;
  try {
    fs.mkdirSync(path.dirname(caminhoEstadoJanela()), { recursive: true });
    fs.writeFileSync(caminhoEstadoJanela(), JSON.stringify(estado));
  } catch (erro) {
    console.error('Não foi possível salvar o estado da janela:', erro);
  }
}

function criarJanela() {
  const estado = lerEstadoJanela();
  const posicao = { width: estado.width, height: estado.height };
  if (estado.x !== undefined) {
    posicao.x = estado.x;
    posicao.y = estado.y;
  }

  janelaPrincipal = new BrowserWindow({
    ...posicao,
    minWidth: TAMANHO_MINIMO.width,
    minHeight: TAMANHO_MINIMO.height,
    show: false, // exibe só quando o conteúdo estiver pronto (evita tela branca)
    backgroundColor: nativeTheme.shouldUseDarkColors ? COR_FUNDO.escuro : COR_FUNDO.claro,
    title: 'Gestão de Matérias',
    webPreferences: {
      // O front-end não tem acesso ao Node.js; tudo passa pelo preload (contextBridge).
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  janelaPrincipal.once('ready-to-show', () => {
    if (estado.maximizado) janelaPrincipal.maximize();
    janelaPrincipal.show();
  });
  // Guarda tamanho/posição em memória a cada mudança e grava ao fechar.
  // O evento 'closed' serve de garantia para fechamentos que não emitem 'close'.
  const janela = janelaPrincipal;
  let ultimoEstado = null;
  const atualizarEstado = () => {
    if (!janela.isDestroyed()) ultimoEstado = { ...janela.getNormalBounds(), maximizado: janela.isMaximized() };
  };
  ['resize', 'move', 'maximize', 'unmaximize', 'show'].forEach((ev) => janela.on(ev, atualizarEstado));
  janela.on('close', () => {
    atualizarEstado();
    salvarEstadoJanela(ultimoEstado);
  });
  janela.on('closed', () => salvarEstadoJanela(ultimoEstado));
  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null;
  });

  janelaPrincipal.loadFile(path.join(__dirname, 'src', 'index.html'));
}

/* ------------------------------------------------------------------ *
 * Menu
 * ------------------------------------------------------------------ */

function montarMenu() {
  const ehMac = process.platform === 'darwin';
  const modelo = [];

  if (ehMac) {
    modelo.push({
      label: app.name,
      submenu: [
        { role: 'about', label: `Sobre ${app.name}` },
        { type: 'separator' },
        { role: 'hide', label: `Ocultar ${app.name}` },
        { role: 'hideOthers', label: 'Ocultar outros' },
        { role: 'unhide', label: 'Mostrar tudo' },
        { type: 'separator' },
        { role: 'quit', label: `Encerrar ${app.name}` },
      ],
    });
  }

  modelo.push({
    label: 'Arquivo',
    submenu: [
      { label: 'Exportar…', accelerator: 'CmdOrCtrl+E', click: () => enviarComandoDoMenu('exportar') },
      { label: 'Importar…', accelerator: 'CmdOrCtrl+O', click: () => enviarComandoDoMenu('importar') },
      { type: 'separator' },
      { role: 'quit', label: 'Sair' },
    ],
  });

  // Necessário para copiar/colar nos campos de texto (principalmente no macOS).
  modelo.push({
    label: 'Editar',
    submenu: [
      { role: 'cut', label: 'Recortar' },
      { role: 'copy', label: 'Copiar' },
      { role: 'paste', label: 'Colar' },
      { role: 'selectAll', label: 'Selecionar tudo' },
    ],
  });

  const itensExibir = [
    {
      label: 'Zoom',
      submenu: [
        { role: 'zoomIn', label: 'Aumentar', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', label: 'Diminuir' },
        { role: 'resetZoom', label: 'Tamanho original' },
      ],
    },
    {
      label: 'Tema',
      submenu: [
        { label: 'Seguir o sistema', value: 'sistema' },
        { label: 'Claro', value: 'claro' },
        { label: 'Escuro', value: 'escuro' },
      ].map(({ label, value }) => ({
        label,
        type: 'radio',
        checked: temaAtual === value,
        click: () => definirTema(value),
      })),
    },
    { type: 'separator' },
    { role: 'togglefullscreen', label: 'Tela cheia' },
  ];
  if (!app.isPackaged) {
    itensExibir.push(
      { type: 'separator' },
      { role: 'reload', label: 'Recarregar' },
      { role: 'toggleDevTools', label: 'Ferramentas do desenvolvedor' },
    );
  }
  modelo.push({ label: 'Exibir', submenu: itensExibir });

  Menu.setApplicationMenu(Menu.buildFromTemplate(modelo));
}

/* ------------------------------------------------------------------ *
 * Segurança
 * ------------------------------------------------------------------ */

/**
 * O app funciona 100% offline: nega qualquer permissão (câmera, notificações,
 * etc.) e cancela requisições de rede que, por algum motivo, sejam feitas.
 */
function aplicarSeguranca() {
  const sessao = session.defaultSession;
  sessao.setPermissionRequestHandler((_conteudo, _permissao, responder) => responder(false));
  sessao.setPermissionCheckHandler(() => false);
  sessao.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_detalhes, responder) => responder({ cancel: true }),
  );
}

// Bloqueia navegação para fora do app, abertura de novas janelas e <webview>.
app.on('web-contents-created', (_evento, conteudo) => {
  conteudo.on('will-navigate', (evento) => evento.preventDefault());
  conteudo.on('will-redirect', (evento) => evento.preventDefault());
  conteudo.on('will-attach-webview', (evento) => evento.preventDefault());
  conteudo.setWindowOpenHandler(() => ({ action: 'deny' }));
});

/* ------------------------------------------------------------------ *
 * Ciclo de vida do aplicativo
 * ------------------------------------------------------------------ */

function iniciar() {
  aplicarTema(lerTemaSalvo()); // antes de criar a janela, para não piscar o tema errado
  acompanharTema();
  aplicarSeguranca();
  registrarIpc();
  montarMenu();
  criarJanela();

  // macOS: recria a janela ao clicar no ícone do Dock se não houver nenhuma aberta.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
}

// Instância única: se o app for aberto de novo, apenas foca a janela existente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!janelaPrincipal) return;
    if (janelaPrincipal.isMinimized()) janelaPrincipal.restore();
    janelaPrincipal.show();
    janelaPrincipal.focus();
  });
  app.whenReady().then(iniciar);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Antes de encerrar, espera terminar qualquer gravação em andamento para que
// a última alteração feita pouco antes de fechar não se perca.
let gravacaoConcluidaAoSair = false;
app.on('before-quit', (evento) => {
  if (gravacaoConcluidaAoSair) return;
  evento.preventDefault();
  filaDeGravacao.finally(() => {
    gravacaoConcluidaAoSair = true;
    app.quit();
  });
});
