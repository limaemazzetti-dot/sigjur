import { createFileRoute } from "@tanstack/react-router";
import { CadastrosPage } from "./configuracoes";

export const Route = createFileRoute("/_authenticated/cadastros")({
  component: CadastrosPage,
});
