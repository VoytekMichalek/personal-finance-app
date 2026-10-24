import { APIError } from "better-auth/api";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import type { ErrorRequestHandler } from "express";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof APIError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    response
      .status(400)
      .json({
        error: error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
      });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      response
        .status(409)
        .json({ error: "This record already exists or was already matched." });
      return;
    }
    if (error.code === "P2025") {
      response.status(404).json({ error: "Record not found." });
      return;
    }
    if (error.code === "P2003") {
      response
        .status(409)
        .json({ error: "This record is referenced by other records." });
      return;
    }
  }
  if (error instanceof Error && error.name === "MulterError") {
    response
      .status(400)
      .json({ error: "Upload a single file, up to 20 MB." });
    return;
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_failed",
      type: error instanceof Error ? error.name : "unknown",
    }),
  );
  response
    .status(500)
    .json({ error: "Something went wrong. Please try again." });
};
