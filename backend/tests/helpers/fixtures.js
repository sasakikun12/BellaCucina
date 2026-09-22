import { createRequire } from "node:module";
import { prisma } from "./db.js";

const require = createRequire(import.meta.url);
const { hashPassword } = require("../../src/utils/password");
const { signToken } = require("../../src/utils/jwt");

let counter = 0;

export async function createStaffUser({
  name = "Usuário de teste",
  email,
  role = "ADMIN",
  password = "password123",
} = {}) {
  counter += 1;
  const passwordHash = await hashPassword(password);
  const user = await prisma.staffUser.create({
    data: {
      name,
      email: email ?? `${role.toLowerCase()}-${counter}@teste.com`,
      role,
      passwordHash,
    },
  });
  const token = signToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });
  return { user, token, password };
}
