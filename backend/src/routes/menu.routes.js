const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");

const menuRouter = Router();

const uploadsDir = path.join(__dirname, "..", "..", "uploads");
/* v8 ignore next */
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Apenas arquivos de imagem são permitidos"));
    cb(null, true);
  },
});

menuRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

const categorySchema = z.object({ name: z.string().min(1) });

menuRouter.post(
  "/categories",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const { name } = categorySchema.parse(req.body);
      const category = await prisma.category.create({ data: { name } });
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  },
);

menuRouter.delete(
  "/categories/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      await prisma.category.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      if (err?.code === "P2003") {
        return next(
          new ApiError(
            409,
            "Não é possível excluir esta categoria pois ela ainda tem itens do cardápio. Mova ou exclua esses itens primeiro.",
          ),
        );
      }
      next(err);
    }
  },
);

menuRouter.get("/", async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const items = await prisma.menuItem.findMany({
      where: categoryId ? { categoryId: String(categoryId) } : undefined,
      include: { category: true },
      orderBy: { name: "asc" },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

const booleanFromFormField = z
  .union([z.boolean(), z.string()])
  .transform((val) => (typeof val === "boolean" ? val : val === "true"))
  .optional();

const menuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().positive(),
  categoryId: z.string().min(1),
  available: booleanFromFormField,
  photoUrl: z
    .string()
    .optional()
    .refine((val) => !val || /^https?:\/\//.test(val) || val.startsWith("/"), {
      message: "URL de foto inválida",
    }),
});

menuRouter.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  upload.single("photo"),
  async (req, res, next) => {
    try {
      const data = menuItemSchema.parse(req.body);
      const photoUrl = req.file
        ? `/uploads/${req.file.filename}`
        : data.photoUrl || null;
      const item = await prisma.menuItem.create({
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          categoryId: data.categoryId,
          available: data.available ?? true,
          photoUrl,
        },
        include: { category: true },
      });
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  },
);

menuRouter.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  upload.single("photo"),
  async (req, res, next) => {
    try {
      const data = menuItemSchema.partial().parse(req.body);
      const photoUrl = req.file
        ? `/uploads/${req.file.filename}`
        : data.photoUrl;
      const existing = await prisma.menuItem.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) throw new ApiError(404, "Item do cardápio não encontrado");

      const item = await prisma.menuItem.update({
        where: { id: req.params.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.available !== undefined && { available: data.available }),
          ...(photoUrl !== undefined && photoUrl !== "" && { photoUrl }),
        },
        include: { category: true },
      });
      res.json(item);
    } catch (err) {
      next(err);
    }
  },
);

menuRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      await prisma.menuItem.delete({ where: { id: req.params.id } });
      res.status(204).send();
    } catch (err) {
      if (err?.code === "P2003") {
        return next(
          new ApiError(
            409,
            "Não é possível excluir este item pois ele já foi usado em pedidos. Marque-o como indisponível em vez de excluí-lo.",
          ),
        );
      }
      next(err);
    }
  },
);

menuRouter.get("/:id/recipe", requireAuth, async (req, res, next) => {
  try {
    const [ingredients, packaging] = await Promise.all([
      prisma.recipeIngredient.findMany({
        where: { menuItemId: req.params.id },
        include: { ingredient: true },
        orderBy: { ingredient: { name: "asc" } },
      }),
      prisma.recipePackaging.findMany({
        where: { menuItemId: req.params.id },
        include: { packagingItem: true },
        orderBy: { packagingItem: { name: "asc" } },
      }),
    ]);
    res.json({
      ingredients: ingredients.map((line) => ({
        ingredientId: line.ingredientId,
        name: line.ingredient.name,
        unit: line.ingredient.unit,
        quantityPerUnit: line.quantityPerUnit,
      })),
      packaging: packaging.map((line) => ({
        packagingItemId: line.packagingItemId,
        name: line.packagingItem.name,
        unit: line.packagingItem.unit,
        quantityPerUnit: line.quantityPerUnit,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const recipeSchema = z.object({
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        quantityPerUnit: z.coerce.number().positive(),
      }),
    )
    .default([]),
  packaging: z
    .array(
      z.object({
        packagingItemId: z.string().min(1),
        quantityPerUnit: z.coerce.number().positive(),
      }),
    )
    .default([]),
});

menuRouter.put(
  "/:id/recipe",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      const data = recipeSchema.parse(req.body);
      const existing = await prisma.menuItem.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) throw new ApiError(404, "Item do cardápio não encontrado");

      await prisma.$transaction([
        prisma.recipeIngredient.deleteMany({
          where: { menuItemId: req.params.id },
        }),
        prisma.recipePackaging.deleteMany({
          where: { menuItemId: req.params.id },
        }),
        ...(data.ingredients.length
          ? [
              prisma.recipeIngredient.createMany({
                data: data.ingredients.map((i) => ({
                  menuItemId: req.params.id,
                  ingredientId: i.ingredientId,
                  quantityPerUnit: i.quantityPerUnit,
                })),
              }),
            ]
          : []),
        ...(data.packaging.length
          ? [
              prisma.recipePackaging.createMany({
                data: data.packaging.map((p) => ({
                  menuItemId: req.params.id,
                  packagingItemId: p.packagingItemId,
                  quantityPerUnit: p.quantityPerUnit,
                })),
              }),
            ]
          : []),
      ]);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

module.exports = { menuRouter };
