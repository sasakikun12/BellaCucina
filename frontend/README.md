# Bella Cucina — Frontend

Interface web do Bella Cucina, construída em ReactJS com Vite.

> A documentação completa do sistema (visão geral, contas de demonstração, como cada módulo funciona) está no [README da raiz do projeto](../README.md). Este arquivo cobre apenas o que é específico do frontend.

## Stack

- React 19 + Vite
- React Router — navegação com rotas protegidas por papel de usuário
- TanStack Query — cache e sincronização do estado vindo da API
- Tailwind CSS — estilização
- socket.io-client — atualizações em tempo real (pedidos e mesas)

## Rodando com Docker

A partir da raiz do projeto, `docker compose up -d --build` sobe este frontend em container junto com o backend e o Postgres. O container roda `vite --host 0.0.0.0` com o código de `src/` montado, então o HMR continua funcionando ao editar. O `VITE_API_URL` é injetado pelo Compose (`http://localhost:4000`). Detalhes no [README da raiz](../README.md#início-rápido-docker).

## Rodando localmente

```bash
npm install
npm run dev   # http://localhost:5173
```

Requer o backend rodando em `http://localhost:4000` (veja o README da raiz para subir o banco de dados e o backend). A URL da API pode ser configurada em `.env` (`VITE_API_URL`).

## Estrutura

```
src/
├── api/          # funções que chamam a API (uma por recurso: menu, pedidos, mesas, estoque...)
├── components/    # componentes reutilizáveis (cartões, modais, formulários)
├── context/       # autenticação (AuthContext) e conexão em tempo real (SocketContext)
├── lib/           # formatação e rótulos compartilhados (status, moeda, papéis de usuário)
├── pages/         # uma página por rota (Cardápio, Mesas, Pedidos, Cozinha, Entregas, Estoque, Equipe...)
├── App.jsx        # definição das rotas
└── main.jsx       # ponto de entrada

Dockerfile         # imagem de dev (Node 20); roda `vite --host 0.0.0.0`
```

## Comandos

| Comando            | O que faz                                  |
| ------------------ | ------------------------------------------ |
| `npm run dev`      | Servidor de desenvolvimento com hot reload |
| `npm run build`    | Build de produção em `dist/`               |
| `npm run preview`  | Serve o build de produção localmente       |
| `npm run lint`     | Roda o Oxlint                              |
| `npm test`         | Vitest com cobertura (falha se < 100%)     |
| `npm run test:nocov` | Vitest sem o gate de cobertura           |
| `npm run test:watch` | Vitest em modo interativo               |

## Testes

[Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/). `npm test` roda a suíte **com cobertura** e falha se ela não for 100% (linhas, ramos, funções e statements — thresholds em `vite.config.js`, com `src/main.jsx` fora da cobertura).

- **`tests/unit`** — funções de `lib/status.js`, os wrappers de API e os interceptors do axios.
- **`tests/context`** — `AuthContext` e `SocketContext`.
- **`tests/components`** e **`tests/pages`** — todas as telas com React Query, o router, o Socket.io e a camada de API mockados.
