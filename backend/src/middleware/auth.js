import jwt from "jsonwebtoken";

export function signToken(officer) {
  return jwt.sign(
    { id: officer.id, email: officer.email, phone: officer.phone, role: officer.role, name: officer.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.officer = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.officer || !roles.includes(req.officer.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Business routes are only for officers (not admins). Admins manage officers only.
export function officerOnly(req, res, next) {
  if (req.officer && req.officer.role === "admin") {
    return res.status(403).json({ error: "Admin has no access to business data" });
  }
  next();
}
