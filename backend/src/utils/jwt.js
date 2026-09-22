const jwt = require("jsonwebtoken");

/* v8 ignore next */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
/* v8 ignore next */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
