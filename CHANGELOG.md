# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

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
