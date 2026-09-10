import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega as variáveis do banco de testes antes de qualquer teste ou de
// src/app.js (que também chama dotenv, mas sem sobrescrever o que já foi
// definido) — garante que os testes nunca toquem no banco de desenvolvimento.
dotenv.config({ path: path.join(__dirname, "..", ".env.test"), override: true });
