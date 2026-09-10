import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { prisma } = require("../../src/prisma");

// Limpa todas as tabelas entre testes, na ordem que respeita as chaves
// estrangeiras (dependentes antes das tabelas que elas referenciam).
export async function resetDatabase() {
  await prisma.stockMovement.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipePackaging.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.packagingItem.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.staffUser.deleteMany();
}

export { prisma };
