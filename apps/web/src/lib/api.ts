import type { ImportConflictDetails } from "@finance/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    public details?: ImportConflictDetails,
    public status?: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return (await apiResponse(path, options)).json() as Promise<T>;
}
export async function apiResponse(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  }).catch(() => {
    throw new ApiError(
      "Could not reach the server. Check your connection, then refresh to check whether your change was saved.",
    );
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
      response.status,
    );
  }
  return response;
}
export const send = <T>(path: string, body: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(body) });
