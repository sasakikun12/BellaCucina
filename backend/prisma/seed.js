const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

async function main() {
  console.log("Semeando o banco de dados...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [
    {
      name: "Ana Administradora",
      email: "admin@restaurant.com",
      role: "ADMIN",
    },
    { name: "Wanda Garçonete", email: "waiter@restaurant.com", role: "WAITER" },
    {
      name: "Caio Cozinheiro",
      email: "kitchen@restaurant.com",
      role: "KITCHEN",
    },
    {
      name: "Diego Entregador",
      email: "delivery@restaurant.com",
      role: "DELIVERY",
    },
  ];
  for (const u of users) {
    await prisma.staffUser.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  const categoryNames = [
    "Entradas",
    "Pratos Principais",
    "Sobremesas",
    "Bebidas",
  ];
  const categories = {};
  for (const name of categoryNames) {
    const c = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories[name] = c.id;
  }

  const items = [
    {
      name: "Bruschetta al Pomodoro",
      description: "Pão italiano tostado com tomate fresco, manjericão e alho.",
      price: 8.5,
      category: "Entradas",
      photoUrl: "https://picsum.photos/seed/bruschetta/600/400",
    },
    {
      name: "Lula Empanada",
      description:
        "Anéis de lula levemente empanados e fritos, servidos com aioli de limão.",
      price: 11.0,
      category: "Entradas",
      photoUrl: "https://picsum.photos/seed/calamari/600/400",
    },
    {
      name: "Salada Caesar",
      description:
        "Alface romana, parmesão, croutons e molho Caesar tradicional.",
      price: 9.5,
      category: "Entradas",
      photoUrl: "https://picsum.photos/seed/caesar/600/400",
    },
    {
      name: "Salmão Grelhado",
      description:
        "Filé de salmão do Atlântico grelhado no ponto, com legumes da estação.",
      price: 22.0,
      category: "Pratos Principais",
      photoUrl: "https://picsum.photos/seed/salmon/600/400",
    },
    {
      name: "Pizza Margherita",
      description:
        "Molho de tomate San Marzano, mussarela fresca, manjericão e azeite extravirgem.",
      price: 14.5,
      category: "Pratos Principais",
      photoUrl: "https://picsum.photos/seed/margherita/600/400",
    },
    {
      name: "Fettuccine Alfredo",
      description: "Fettuccine fresco ao molho cremoso de parmesão.",
      price: 16.0,
      category: "Pratos Principais",
      photoUrl: "https://picsum.photos/seed/fettuccine/600/400",
    },
    {
      name: "Bife Ancho",
      description:
        "Bife ancho de 340g, no ponto desejado, com purê de batata e alho.",
      price: 28.0,
      category: "Pratos Principais",
      photoUrl: "https://picsum.photos/seed/ribeye/600/400",
    },
    {
      name: "Tiramisù",
      description:
        "Clássica sobremesa italiana com biscoito champanhe embebido em café e mascarpone.",
      price: 7.5,
      category: "Sobremesas",
      photoUrl: "https://picsum.photos/seed/tiramisu/600/400",
    },
    {
      name: "Bolo Vulcão de Chocolate",
      description:
        "Bolo de chocolate quente com recheio cremoso, servido com sorvete de baunilha.",
      price: 8.0,
      category: "Sobremesas",
      photoUrl: "https://picsum.photos/seed/lavacake/600/400",
    },
    {
      name: "Limonada com Gás",
      description: "Limonada caseira com um toque de água com gás.",
      price: 4.5,
      category: "Bebidas",
      photoUrl: "https://picsum.photos/seed/lemonade/600/400",
    },
    {
      name: "Cola Artesanal",
      description:
        "Cola artesanal de produção em pequena escala, servida com gelo.",
      price: 4.0,
      category: "Bebidas",
      photoUrl: "https://picsum.photos/seed/cola/600/400",
    },
    {
      name: "Vinho Tinto da Casa (Taça)",
      description:
        "Vinho tinto equilibrado e encorpado médio, selecionado pelo nosso sommelier.",
      price: 9.0,
      category: "Bebidas",
      photoUrl: "https://picsum.photos/seed/redwine/600/400",
    },
  ];

  const menuItemIds = {};
  for (const item of items) {
    let record = await prisma.menuItem.findFirst({
      where: { name: item.name },
    });
    if (!record) {
      record = await prisma.menuItem.create({
        data: {
          name: item.name,
          description: item.description,
          price: item.price,
          photoUrl: item.photoUrl,
          categoryId: categories[item.category],
        },
      });
    }
    menuItemIds[item.name] = record.id;
  }

  const ingredientDefs = [
    ["Farinha de Trigo", "kg", 25, 5],
    ["Tomate", "kg", 12, 3],
    ["Manjericão", "g", 300, 200], // proposital: perto do mínimo, para exercitar o alerta de estoque baixo
    ["Alho", "g", 800, 150],
    ["Azeite de Oliva", "ml", 4000, 500],
    ["Lula", "kg", 6, 2],
    ["Limão", "kg", 8, 2],
    ["Alface Romana", "kg", 5, 2],
    ["Parmesão", "kg", 4, 1],
    ["Croutons", "g", 1500, 300],
    ["Salmão", "kg", 9, 3],
    ["Batata", "kg", 15, 4],
    ["Mussarela", "kg", 7, 2],
    ["Fettuccine", "kg", 8, 2],
    ["Creme de Leite", "ml", 3000, 500],
    ["Bife Ancho", "kg", 10, 3],
    ["Mascarpone", "kg", 0.8, 1], // proposital: abaixo do mínimo, para exercitar o alerta de estoque baixo
    ["Café", "g", 500, 100],
    ["Biscoito Champanhe", "kg", 2, 0.5],
    ["Chocolate", "kg", 3, 1],
    ["Sorvete de Baunilha", "ml", 4000, 1000],
    ["Açúcar", "kg", 10, 2],
    ["Água com Gás", "L", 30, 8],
    ["Xarope de Cola", "ml", 2000, 400],
    ["Vinho Tinto", "L", 12, 3],
  ];
  const ingredientIds = {};
  for (const [name, unit, currentStock, minStock] of ingredientDefs) {
    const record = await prisma.ingredient.upsert({
      where: { name },
      update: {},
      create: { name, unit, currentStock, minStock },
    });
    ingredientIds[name] = record.id;
  }

  const packagingDefs = [
    ["Caixa de Pizza", "un", 40, 10],
    ["Embalagem Térmica Pequena", "un", 60, 15],
    ["Embalagem Térmica Média", "un", 50, 15],
    ["Copo para Bebida com Tampa", "un", 80, 20],
    ["Sacola de Entrega", "un", 100, 25],
  ];
  const packagingIds = {};
  for (const [name, unit, currentStock, minStock] of packagingDefs) {
    const record = await prisma.packagingItem.upsert({
      where: { name },
      update: {},
      create: { name, unit, currentStock, minStock },
    });
    packagingIds[name] = record.id;
  }

  const recipes = {
    "Bruschetta al Pomodoro": {
      ingredients: {
        "Farinha de Trigo": 0.1,
        Tomate: 0.08,
        Manjericão: 5,
        Alho: 5,
        "Azeite de Oliva": 10,
      },
      packaging: { "Embalagem Térmica Pequena": 1 },
    },
    "Lula Empanada": {
      ingredients: { Lula: 0.15, "Farinha de Trigo": 0.05, Limão: 0.05 },
      packaging: { "Embalagem Térmica Pequena": 1 },
    },
    "Salada Caesar": {
      ingredients: { "Alface Romana": 0.15, Parmesão: 0.03, Croutons: 20 },
      packaging: { "Embalagem Térmica Pequena": 1 },
    },
    "Salmão Grelhado": {
      ingredients: { Salmão: 0.25, "Azeite de Oliva": 15, Batata: 0.15 },
      packaging: { "Embalagem Térmica Média": 1 },
    },
    "Pizza Margherita": {
      ingredients: {
        "Farinha de Trigo": 0.25,
        Tomate: 0.1,
        Mussarela: 0.15,
        Manjericão: 5,
        "Azeite de Oliva": 10,
      },
      packaging: { "Caixa de Pizza": 1 },
    },
    "Fettuccine Alfredo": {
      ingredients: { Fettuccine: 0.2, "Creme de Leite": 100, Parmesão: 0.05 },
      packaging: { "Embalagem Térmica Média": 1 },
    },
    "Bife Ancho": {
      ingredients: { "Bife Ancho": 0.34, Batata: 0.2, Alho: 5 },
      packaging: { "Embalagem Térmica Média": 1 },
    },
    Tiramisù: {
      ingredients: { Mascarpone: 0.08, Café: 10, "Biscoito Champanhe": 0.05 },
      packaging: { "Embalagem Térmica Pequena": 1 },
    },
    "Bolo Vulcão de Chocolate": {
      ingredients: {
        Chocolate: 0.1,
        "Farinha de Trigo": 0.05,
        "Sorvete de Baunilha": 50,
      },
      packaging: { "Embalagem Térmica Pequena": 1 },
    },
    "Limonada com Gás": {
      ingredients: { Limão: 0.1, Açúcar: 0.03, "Água com Gás": 0.2 },
      packaging: { "Copo para Bebida com Tampa": 1 },
    },
    "Cola Artesanal": {
      ingredients: { "Xarope de Cola": 30, "Água com Gás": 0.2 },
      packaging: { "Copo para Bebida com Tampa": 1 },
    },
    "Vinho Tinto da Casa (Taça)": {
      ingredients: { "Vinho Tinto": 0.15 },
      packaging: { "Copo para Bebida com Tampa": 1 },
    },
  };

  for (const [itemName, recipe] of Object.entries(recipes)) {
    const menuItemId = menuItemIds[itemName];
    if (!menuItemId) continue;
    for (const [ingredientName, quantityPerUnit] of Object.entries(
      recipe.ingredients ?? {},
    )) {
      await prisma.recipeIngredient.upsert({
        where: {
          menuItemId_ingredientId: {
            menuItemId,
            ingredientId: ingredientIds[ingredientName],
          },
        },
        update: { quantityPerUnit },
        create: {
          menuItemId,
          ingredientId: ingredientIds[ingredientName],
          quantityPerUnit,
        },
      });
    }
    for (const [packagingName, quantityPerUnit] of Object.entries(
      recipe.packaging ?? {},
    )) {
      await prisma.recipePackaging.upsert({
        where: {
          menuItemId_packagingItemId: {
            menuItemId,
            packagingItemId: packagingIds[packagingName],
          },
        },
        update: { quantityPerUnit },
        create: {
          menuItemId,
          packagingItemId: packagingIds[packagingName],
          quantityPerUnit,
        },
      });
    }
  }

  for (let i = 1; i <= 8; i++) {
    await prisma.restaurantTable.upsert({
      where: { number: i },
      update: {},
      create: { number: i, capacity: i % 2 === 0 ? 4 : 2 },
    });
  }

  console.log("Base de dados semeada com sucesso.");
  console.log(
    "Logins de demonstração (todos usam a senha: %s):",
    DEMO_PASSWORD,
  );
  for (const u of users) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
