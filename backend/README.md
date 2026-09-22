# Bella Cucina — Backend

API REST + WebSocket do Bella Cucina, construída em Node.js com Express.

> A documentação completa do sistema (visão geral, contas de demonstração, como cada módulo funciona) está no [README da raiz do projeto](../README.md). Este arquivo cobre apenas o que é específico do backend.

## Stack

- Node.js 20+ + Express — JavaScript
- Prisma ORM + PostgreSQL — schema e migrations em `prisma/`
- socket.io — eventos de pedidos e mesas em tempo real
- JWT (`jsonwebtoken`) + `bcryptjs` — autenticação e hashing de senha
- Zod — validação dos payloads
- Multer — upload das fotos do cardápio (gravadas em `uploads/`)

## Rodando com Docker

A partir da raiz do projeto, `docker compose up -d --build` sobe este backend em container junto com o Postgres e o frontend. Na inicialização, o `docker-entrypoint.sh` aplica as migrations (`prisma migrate deploy`), regenera o Prisma Client, roda o seed e então inicia `npm run dev` — nenhum passo manual é necessário. O código de `src/` fica montado no container, então o `node --watch` recarrega ao editar. Detalhes no [README da raiz](../README.md#início-rápido-docker).

## Rodando localmente

```bash
npm install
npx prisma migrate dev   # cria as tabelas
npm run seed             # dados de demonstração (seguro repetir)
npm run dev              # http://localhost:4000 (via node --watch)
```

Requer um PostgreSQL acessível — veja o README da raiz para subir o container. A configuração fica em `.env` (copie de `.env.example`):

| Variável         | Padrão                                                          | Para quê                                      |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `DATABASE_URL`   | `postgresql://restaurant:restaurant@localhost:15432/restaurant` | conexão do Prisma                             |
| `JWT_SECRET`     | —                                                               | segredo de assinatura dos tokens              |
| `JWT_EXPIRES_IN` | `12h`                                                           | validade do token                             |
| `PORT`           | `4000`                                                          | porta HTTP                                    |
| `HOST`           | `127.0.0.1`                                                     | interface de escuta (o container usa `0.0.0.0`) |
| `CORS_ORIGIN`    | `http://localhost:5173`                                         | origem liberada para o frontend e o Socket.io |

Por padrão o servidor escuta apenas em `127.0.0.1` (loopback); defina `HOST=0.0.0.0` para expô-lo (é o que o container faz).

## Estrutura

```
src/
├── index.js            # bootstrap: cria o HTTP server, pluga o socket.io e escuta
├── app.js              # monta o app Express (sem escutar) — usado também nos testes
├── prisma.js           # instância única do PrismaClient
├── socket.js           # init do socket.io (handshake JWT) e emitters de domínio
├── routes/             # um router por recurso: auth, menu, orders, tables, users, stock
├── middleware/         # requireAuth / requireRole e o errorHandler central
├── lib/stock.js        # baixa, devolução e estorno de estoque (consumido pelas rotas de pedido)
└── utils/              # jwt (sign/verify) e password (hash/compare)
prisma/
├── schema.prisma       # modelos e enums
├── migrations/         # histórico de migrations
└── seed.js             # usuários, cardápio, mesas, estoque e receitas de demonstração

Dockerfile              # imagem de dev (Node 20); roda migrations + seed no boot
docker-entrypoint.sh    # prisma migrate deploy → generate → seed → npm run dev
```

Regras de negócio principais: acesso por papel aplicado na API (JWT + `requireRole`); criar um pedido dá baixa nos ingredientes, despachar uma entrega dá baixa nas embalagens e cancelar devolve exatamente o que foi debitado, tudo em transação; toda movimentação vira um registro de auditoria em `StockMovement`.

## Comandos

| Comando                                  | O que faz                                             |
| ---------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                            | Servidor com reload (`node --watch`)                  |
| `npm start`                              | Servidor sem reload                                   |
| `npm run seed`                           | Recria os dados de demonstração (seguro repetir)      |
| `npm run prisma:migrate`                 | Cria/aplica uma migration após editar `schema.prisma` |
| `npm run prisma:studio`                  | Abre o Prisma Studio para navegar o banco             |
| `npm run prisma:generate`                | Regenera o Prisma Client                              |
| `npm test`                               | Vitest com cobertura (falha se < 100%)                |
| `npm run test:nocov`                     | Vitest sem o gate de cobertura                        |
| `npm run test:watch`                     | Vitest em modo interativo                             |
| `npm run test:unit` / `test:integration` | Só uma das pastas                                     |

## Testes

[Vitest](https://vitest.dev/). `npm test` roda `tests/unit` + `tests/integration` **com cobertura** e falha se ela não for 100% (linhas, ramos, funções e statements — thresholds em `vitest.config.js`). As poucas linhas fora do alcance dos testes (fallbacks de env lidos no carregamento do módulo, o ramo do logger fora do ambiente de teste) levam `/* v8 ignore */` com um comentário do porquê.

- **`tests/unit`** — `lib/stock.js` com o Prisma mockado, `utils/jwt`, `utils/password`, `middleware/errorHandler`, `middleware/auth`, o handshake e os emitters do `socket.js`, e o bootstrap de `src/index.js`.
- **`tests/integration`** — [supertest](https://github.com/ladjs/supertest) contra o app Express de verdade: login e `/me`, cardápio (incl. upload de imagem e receitas), o ciclo completo de um pedido consumindo e devolvendo estoque no banco, ingredientes/embalagens/movimentações, mesas, equipe, e os caminhos de erro (respostas 500 e violações de FK).

Os testes de integração usam um banco `restaurant_test` separado. Configuração única:

```bash
docker exec restaurant-postgres psql -U restaurant -d postgres -c "CREATE DATABASE restaurant_test;"
DATABASE_URL="postgresql://restaurant:restaurant@127.0.0.1:15432/restaurant_test?schema=public" npx prisma db push
npm test
```
