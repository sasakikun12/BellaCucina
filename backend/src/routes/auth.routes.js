const { Router } = require("express");
const { z } = require("zod");
const { prisma } = require("../prisma");
const { comparePassword } = require("../utils/password");
const { signToken } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");
const { ApiError } = require("../middleware/errorHandler");

const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.staffUser.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, "E-mail ou senha inválidos");

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new ApiError(401, "E-mail ou senha inválidos");

    const token = signToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.staffUser.findUnique({ where: { id: req.user.sub } });
    if (!user) throw new ApiError(404, "Usuário não encontrado");
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
});

module.exports = { authRouter };
