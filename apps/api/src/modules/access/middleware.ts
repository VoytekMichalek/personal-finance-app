import type { RequestHandler } from "express";
import { auth, requestHeaders } from "./auth.js";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
export const requireUser: RequestHandler = async (request, response, next) => {
  const session = await auth.api.getSession({
    headers: requestHeaders(request),
  });
  if (!session) throw new HttpError(401, "Please sign in.");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.state !== "active")
    throw new HttpError(401, "This account is no longer active.");
  response.locals.user = user;
  next();
};
export const requireAdmin: RequestHandler = (_request, response, next) => {
  if (response.locals.user?.role !== "admin")
    throw new HttpError(403, "Administrator access required.");
  next();
};
