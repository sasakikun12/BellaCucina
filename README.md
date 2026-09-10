# Bella Cucina — Sistema de Gestão para Restaurantes

Sistema web completo para restaurantes: **Cardápio** (fotos, descrições, preços), **Pedidos**, **Cozinha**, **Mesas**, **Entregas** e **Estoque**, com login por papel de usuário e atualizações em tempo real entre as telas.

- **Frontend**: React + JavaScript + Vite, React Router, TanStack Query, Tailwind CSS, cliente Socket.io
- **Backend**: Node.js + Express + JavaScript, Prisma ORM, PostgreSQL, Socket.io, autenticação JWT

## Pré-requisitos

- **Docker Desktop** — suficiente para rodar o sistema inteiro (opção recomendada abaixo)
- **Node.js 20+** — necessário apenas para desenvolvimento local sem containers para a aplicação

## Início rápido (Docker)

Sobe PostgreSQL, backend e frontend em containers, já com as migrations e o seed aplicados automaticamente:

```bash
docker compose up -d --build
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 (health em `/api/health`) |
| PostgreSQL | `localhost:15432` (usuário/senha/banco: `restaurant`) |

O código de `backend/` e `frontend/` é montado nos containers, então o hot reload (Vite HMR e `node --watch`) continua funcionando enquanto você edita.

| Comando | O que faz |
|---|---|
| `docker compose logs -f backend frontend` | Acompanha os logs da aplicação |
| `docker compose down` | Para tudo (use `-v` para apagar também o volume do banco) |
| `docker compose up -d --build -V` | Refaz as imagens após instalar novas dependências (`-V` recria os volumes anônimos de `node_modules`) |

> **Por que a porta 15432?** Em algumas máquinas, softwares de segurança locais interceptam a porta padrão 5432 e quebram a conexão silenciosamente. O `docker-compose.yml` mapeia a porta 5432 do container para a 15432 do host para evitar isso. Dentro da rede do Compose, os containers seguem falando com o Postgres em `postgres:5432`.

## Contas de demonstração

Todas usam a senha `password123`:

| Papel        | E-mail                    |
|--------------|----------------------------|
| Administrador| admin@restaurant.com       |
| Garçom       | waiter@restaurant.com      |
| Cozinha      | kitchen@restaurant.com     |
| Entregador   | delivery@restaurant.com    |

## Desenvolvimento local (sem containers para a aplicação)

Use os containers apenas para o banco e rode backend/frontend direto na máquina.

### 1. Subir o banco de dados

```bash
docker compose up -d postgres
```

Se você não tiver o problema da porta descrito acima, sinta-se à vontade para voltar a usar `5432:5432` no `docker-compose.yml` (e atualizar a `DATABASE_URL` em `backend/.env` de acordo).

### 2. Configurar o backend

```bash
cd backend
npm install
npx prisma migrate dev   # cria as tabelas
npm run seed              # usuários de demonstração, cardápio, categorias, mesas, estoque e receitas
npm run dev                # http://localhost:4000
```

### 3. Configurar o frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

### Ou rodar tudo de uma vez

A partir da raiz do repositório:

```bash
npm run install:all
npm run db:up      # docker compose up -d postgres
npm run dev
```

## Como o sistema está organizado

- **Cardápio** — categorias e itens com foto (upload de arquivo ou URL), descrição e preço. A página inicial (`/`) exibe o cardápio publicamente, sem exigir login — qualquer visitante pode navegar pelas categorias e ver os detalhes de cada prato (imagem ampliada, descrição completa). Apenas administradores podem criar, editar ou excluir itens e categorias.
- **Mesas** — mapa do salão. Garçons recebem clientes, iniciam pedidos no local e, sobre um pedido já aberto, podem adicionar novos itens, aumentar ou diminuir quantidades e remover itens — por exemplo, quando o cliente pede uma sobremesa depois do prato principal. Ao concluir o atendimento, a mesa é liberada automaticamente.
- **Pedidos** — painel com todos os pedidos (no salão, para viagem ou de entrega) e o status de cada um; garçons e administradores também podem criar pedidos por aqui.
- **Cozinha** — fila de preparo em tempo real, dos pedidos mais antigos para os mais recentes. A equipe da cozinha avança cada item entre Pendente → Em preparo → Pronto; o status do pedido como um todo avança automaticamente conforme os itens ficam prontos.
- **Entregas** — a equipe de entrega assume os pedidos assim que ficam prontos e os marca como entregues ao final da corrida.
- **Estoque** — controle de insumos. Administradores cadastram **ingredientes** (ex.: "Mussarela, 7 kg") e **embalagens** de entrega (ex.: "Caixa de Pizza, 40 un"), e associam a cada item do cardápio uma **receita**: quanto de cada ingrediente ele consome (em qualquer tipo de pedido) e quanto de embalagem consome (somente em pedidos de entrega). Criar um pedido dá baixa automática nos ingredientes; despachar uma entrega (atribuir um entregador) dá baixa nas embalagens; cancelar um pedido devolve exatamente o que já havia sido debitado. Pedidos que deixariam o estoque negativo são recusados com uma mensagem clara. Toda movimentação — venda, reposição manual, ajuste ou estorno de cancelamento — fica registrada em um histórico de auditoria (**Movimentações**), e itens no limite mínimo ou abaixo dele geram um alerta de estoque baixo no Painel e na própria tela de Estoque.
- **Equipe** — administradores gerenciam as contas da equipe (nome, e-mail, papel).
- **Painel** — visão geral para administradores: pedidos ativos, mesas ocupadas, itens no cardápio e alertas de estoque baixo, com atalhos para todas as demais telas.

O acesso por papel de usuário é aplicado tanto na interface (rotas e menu de navegação) quanto na API (autenticação JWT e middleware de autorização). Alterações em pedidos e mesas são transmitidas via Socket.io, então qualquer tela aberta (por exemplo, Cozinha e Pedidos em abas diferentes) é atualizada instantaneamente, sem precisar recarregar a página.

## Comandos úteis

| Comando (na raiz) | O que faz |
|---|---|
| `npm run docker:up` | `docker compose up -d --build` — sobe o stack completo |
| `npm run docker:down` | Para o stack |
| `npm run docker:logs` | Segue os logs de backend e frontend |

| Comando (em `backend/`) | O que faz |
|---|---|
| `npm run prisma:studio` | Navegar e editar o banco de dados visualmente |
| `npm run seed` | Recriar os dados de demonstração (seguro executar novamente) |
| `npm run prisma:migrate` | Criar/aplicar uma migration após editar `schema.prisma` |

JavaScript puro, sem etapa de build — `npm run dev` (via `node --watch`) ou `npm start` executam o código-fonte diretamente.

| Comando (em `frontend/`) | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite), com hot reload |
| `npm run build` | Build de produção em `dist/` |
| `npm run lint` | Análise estática com [oxlint](https://oxc.rs/) |

## Testes

Ambos os pacotes usam [Vitest](https://vitest.dev/). Em cada um, `npm test` roda a suíte **com cobertura** e **falha se a cobertura não for 100%** (linhas, ramos, funções e statements — thresholds em `backend/vitest.config.js` e `frontend/vite.config.js`). Use `npm run test:nocov` para rodar sem o gate de cobertura e `npm run test:watch` no modo interativo. As poucas linhas fora do alcance dos testes (fallbacks de configuração lidos só no carregamento do módulo, o bootstrap do servidor fora do ambiente de teste) são marcadas com `/* v8 ignore */` e um comentário explicando o porquê.

| Pacote | Arquivos | Testes | Cobertura |
|---|---:|---:|---|
| Backend | 15 | 182 | 100% |
| Frontend | 25 | 211 | 100% |

**Backend** (`backend/tests/`):

- `tests/unit` — lógica de baixa/devolução de estoque (`lib/stock.js`) com o Prisma mockado, JWT, hashing de senha, `errorHandler`, o middleware de autenticação/autorização, o handshake e os emitters do Socket.io, e o bootstrap do servidor (`src/index.js`).
- `tests/integration` — [supertest](https://github.com/ladjs/supertest) contra o app Express de verdade: login, cardápio (incl. upload de imagem e receitas), o ciclo completo de um pedido consumindo e devolvendo estoque no banco, ingredientes/embalagens/movimentações, mesas, equipe, e os caminhos de erro (respostas 500 e violações de FK).

Os testes de integração precisam de um Postgres de testes separado (o mesmo container `restaurant-postgres`, com um banco `restaurant_test` à parte para nunca tocar nos dados de desenvolvimento). Configuração única (o `npm install` já traz o `@vitest/coverage-v8`):

```bash
docker exec restaurant-postgres psql -U restaurant -d postgres -c "CREATE DATABASE restaurant_test;"
cd backend
DATABASE_URL="postgresql://restaurant:restaurant@127.0.0.1:15432/restaurant_test?schema=public" npx prisma db push
npm test
```

**Frontend** (`frontend/tests/`, via Vitest + [Testing Library](https://testing-library.com/)): `npm test` cobre `tests/unit` (funções de `lib/status.js`, os wrappers de API e os interceptors do axios), `tests/context` (`AuthContext`, `SocketContext`) e `tests/components` + `tests/pages` — todas as telas com React Query, o router, o Socket.io e a camada de API mockados. `src/main.jsx` (apenas o `createRoot` do ReactDOM) fica fora da cobertura.
