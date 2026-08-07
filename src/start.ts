import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

const releaseMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  const result = await next();
  result.response.headers.set(
    "X-Sigjur-Release",
    "2026.07.29-busca-processo-fornecedor-comprovante",
  );

  if (handlerType === "router") {
    result.response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    );
    result.response.headers.set("Pragma", "no-cache");
    result.response.headers.set("Expires", "0");
  }

  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware, releaseMiddleware, errorMiddleware],
}));
