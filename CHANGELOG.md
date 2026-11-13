# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

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
