import type { ImportConflictDetails } from "@finance/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    public details?: ImportConflictDetails,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({ error: "Request failed." }))) as {
      error?: string;
      message?: string;
      details?: ImportConflictDetails;
    };
    throw new ApiError(
      body.error ?? body.message ?? "Request failed.",
      body.details,
    );
  }
  return response.json() as Promise<T>;
}
export const send = <T>(path: string, body: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(body) });
