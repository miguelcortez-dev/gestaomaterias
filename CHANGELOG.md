# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [0.7.0] - 2026-11-26

### Adicionado

- Tema escuro, além do claro. Em Exibir › Tema é possível escolher "Seguir o
  sistema" (padrão), "Claro" ou "Escuro"; o botão com o ícone de sol/lua no
  cabeçalho alterna rapidamente entre claro e escuro. A escolha é lembrada
  entre as sessões e também vale para os diálogos nativos do Windows.

## [0.6.1] - 2026-11-13

### Adicionado

- Instalador para Windows (NSIS), gerado com `npm run dist` e publicado nas
  releases do GitHub.

### Corrigido

- Ao fechar o aplicativo, a gravação em andamento é concluída antes de
  encerrar, para que a última alteração não se perca.

## [0.6.0] - 2026-11-12

### Adicionado

- Painel de resumo acima do fluxograma: total de matérias, aprovadas (com
  quantas estão sendo cursadas ou reprovadas), percentual concluído com barra
  de progresso, carga horária concluída em relação ao total, períodos previstos
  e extras, e a quantidade de avisos de pré-requisito.
- Exportar os dados do curso para um arquivo JSON (botão "Exportar", menu
  Arquivo › Exportar… ou Ctrl+E), escolhendo o destino em um diálogo nativo.
- Importar dados de um arquivo JSON (botão "Importar", menu Arquivo › Importar…
  ou Ctrl+O): o arquivo é validado (limite de 5 MB) e o app pede confirmação
  antes de substituir os dados atuais.

## [0.5.0] - 2026-11-12

### Adicionado

- Status das matérias ("Pendente", "Cursando", "Aprovada" e "Reprovada"), com
  cores distintas na borda do card e no selo de status.
- Ao marcar uma matéria como "Reprovada", o app oferece recolocá-la em um
  período posterior (ou em um novo período extra), registrando a reprovação no
  histórico e mostrando a tentativa atual no card (ex.: "2ª tentativa").
- Histórico de tentativas no formulário de edição da matéria.
- Aviso (sem bloquear) quando uma matéria está no mesmo período ou antes de um
  de seus pré-requisitos: o card fica em destaque laranja, a seta fica
  tracejada e uma mensagem explica o problema.

### Alterado

- Setas entre matérias do mesmo período ou que "voltam" para um período
  anterior agora fazem um percurso próprio, sem atravessar os cards.

## [0.4.0] - 2026-11-12

### Adicionado

- Campo "Pré-requisitos" no formulário da matéria: lista de seleção múltipla
  agrupada por período, com filtro por nome ou código.
- Setas em SVG (curvas suaves) ligando cada pré-requisito à matéria que
  depende dele, atualizadas ao mover, editar, excluir ou redimensionar a janela.
- Criação de ligações direto no fluxograma, arrastando a bolinha do card até a
  matéria dependente; clicar em uma seta remove a ligação (com confirmação).
- Destaque, ao passar o mouse ou clicar em uma matéria, de tudo o que ela exige
  e de tudo o que ela libera (direta ou indiretamente), esmaecendo o restante.
- Prevenção de dependências circulares, com mensagem mostrando o ciclo
  (ex.: "Cálculo I → Cálculo II → Cálculo I").

### Alterado

- Excluir uma matéria também remove as ligações associadas a ela.

## [0.3.0] - 2026-11-12

### Adicionado

- Botão "+" flutuante (e atalho Ctrl+N) para cadastrar matérias em um
  formulário com nome (obrigatório), código, carga horária e período.
- Botão "+" no cabeçalho de cada coluna para criar a matéria já naquele período.
- Cards de matéria com código, nome e carga horária.
- Edição (botão, duplo clique ou Enter) e exclusão (botão, Delete ou pelo
  formulário) de matérias, sempre com confirmação antes de excluir.
- Arrastar e soltar cards entre períodos e reordená-los dentro da coluna;
  também é possível mudar o período pelo formulário.

## [0.2.0] - 2026-11-12

### Adicionado

- Pergunta, na primeira execução, quantos períodos (semestres) o curso tem;
  o valor pode ser alterado a qualquer momento em "Configurações".
- Fluxograma com um período por coluna ("1º período", "2º período"...), em
  ordem da esquerda para a direita, com rolagem horizontal.
- Botão "+ Período" para adicionar períodos extras, identificados com o selo
  "Extra" e cor diferente.
- Remoção de períodos vazios, com confirmação.

## [0.1.0] - 2026-11-12

### Adicionado

- Estrutura do projeto Electron com interface em HTML, CSS e JavaScript puro.
- Janela principal com tamanho mínimo, que lembra tamanho e posição da última sessão.
- Menu em português (Arquivo, Editar e Exibir, com zoom e tela cheia).
- Instância única: abrir o app de novo apenas foca a janela existente.
- Segurança: `contextIsolation`, `sandbox`, preload com API mínima, Content
  Security Policy restritiva, bloqueio de navegação, de novas janelas, de
  permissões e de qualquer acesso à rede.
- Persistência em `curso.json` na pasta de dados do usuário, criada na primeira
  execução, com gravação atômica, validação antes de gravar e cópia de
  segurança (`curso.json.bak`).
- Recuperação automática a partir da cópia de segurança se o arquivo principal
  estiver danificado.
