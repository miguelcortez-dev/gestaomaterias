# Gestão de Matérias

Aplicativo de desktop para controlar as matérias da faculdade em forma de
fluxograma: períodos em colunas, matérias em cards e pré-requisitos ligados por
setas. Funciona totalmente offline, em janela própria, e guarda os dados no
seu computador.

> Projeto em desenvolvimento. Consulte o [CHANGELOG](CHANGELOG.md) para ver o que já está disponível.

## Requisitos (desenvolvimento)

- [Node.js](https://nodejs.org/) 20 ou superior (inclui o npm).

## Como rodar em desenvolvimento

```bash
npm install
npm start
```

## Onde ficam os dados

Os dados ficam no arquivo `curso.json`, dentro da pasta de dados do usuário do
sistema. A versão anterior é mantida em `curso.json.bak`.

Para fazer uma cópia ou levar os dados para outro computador, use
**Arquivo › Exportar…** (Ctrl+E) e, no destino, **Arquivo › Importar…** (Ctrl+O).
