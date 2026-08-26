import { createMiddleware } from "@tanstack/react-start";
import type { AccessLevel } from "./auth-middleware";

export const requireEditorAccess = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const accessLevel = (context as unknown as { accessLevel?: AccessLevel }).accessLevel;
    if (accessLevel === "viewer") {
      throw new Error(
        "Seu acesso é de Visualizador. Você pode consultar e exportar informações, mas não pode alterar dados.",
      );
    }
    if (accessLevel !== "admin" && accessLevel !== "editor") {
      throw new Error("Acesso negado.");
    }
    return next();
  },
);

/**
 * Operações administrativas (usuários, permissões e cópias completas dos
 * dados) não podem ser executadas por perfis de editor ou visualizador.
 */
export const requireAdminAccess = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    const accessLevel = (context as unknown as { accessLevel?: AccessLevel }).accessLevel;
    if (accessLevel !== "admin") {
      throw new Error("Acesso restrito a administradores.");
    }
    return next();
  },
);
