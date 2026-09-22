const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { hashPassword } = require("../utils/password");
const { ApiError } = require("../middleware/errorHandler");

const usersRouter = Router();

usersRouter.get("/", requireAuth, requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const users = await prisma.staffUser.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "WAITER", "KITCHEN", "DELIVERY"]),
});

usersRouter.post("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const existing = await prisma.staffUser.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError(409, "Já existe um usuário com este e-mail");

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.staffUser.create({
      data: { name: data.name, email: data.email, role: data.role, passwordHash },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    if (req.params.id === req.user.sub) throw new ApiError(400, "Você não pode excluir sua própria conta");
    await prisma.staffUser.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = { usersRouter };
