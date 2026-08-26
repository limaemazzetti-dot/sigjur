import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { hydrateSupabasePublicConfig, supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AgendaAlert } from "@/components/agenda-alert";
import { TableColumnResizer } from "@/components/table-column-resizer";
import { getMe } from "@/lib/users.functions";
import { ALL_PAGES } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    await hydrateSupabasePublicConfig();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const location = useLocation();
  const meFn = useServerFn(getMe);
  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => meFn(),
  });
  const readOnly = me?.accessLevel === "viewer";
  const currentPage = ALL_PAGES.find(
    (page) => location.pathname === page.path || location.pathname.startsWith(`${page.path}/`),
  );
  const pageAllowed =
    !currentPage ||
    me?.isAdmin ||
    !me?.pagePermissionsConfigured ||
    (me?.allowedPages ?? []).includes(currentPage.path);

  function explainReadOnly() {
    toast.info(
      "Acesso de Visualizador: você pode consultar e exportar, mas não pode alterar dados.",
    );
  }

  function handleReadOnlyClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!readOnly) return;
    const button = (event.target as Element).closest<HTMLElement>(
      "button, [role='button'], [data-write-action]",
    );
    if (!button) return;
    const label = [
      button.textContent,
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
    ]
      .filter(Boolean)
      .join(" ");
    const hasWriteIcon = Boolean(
      button.querySelector(
        ".lucide-plus, .lucide-pencil, .lucide-trash, .lucide-save, .lucide-upload, .lucide-file-up",
      ),
    );
    const isWriteAction =
      hasWriteIcon ||
      /\b(novo|nova|salvar|criar|excluir|remover|editar|adicionar|importar|sincronizar|gerar|anexar)\b/i.test(
        label,
      );
    if (!isWriteAction) return;
    event.preventDefault();
    event.stopPropagation();
    explainReadOnly();
  }

  function handleReadOnlySubmit(event: React.FormEvent<HTMLDivElement>) {
    if (!readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    explainReadOnly();
  }

  return (
    <SidebarProvider className="h-[100dvh] min-h-0 overflow-hidden">
      <div className="h-full min-h-0 flex w-full overflow-hidden bg-background">
        <TableColumnResizer />
        <AppSidebar />
        <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0 dark">
            <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between">
              <SidebarTrigger className="lg:hidden text-sidebar-foreground" />
              <div className="hidden lg:block min-w-0" />

              <div className="flex items-center gap-1 shrink-0">
                {readOnly && (
                  <span className="hidden sm:inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Visualizador · somente leitura
                  </span>
                )}
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="flex-1 min-h-0 overflow-hidden bg-muted/30 p-2 sm:p-3 lg:p-4">
            <div
              key={location.pathname}
              className="animate-fade-in h-full w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-background shadow-sm [scrollbar-gutter:stable]"
            >
              <div
                className="h-full w-full"
                onClickCapture={handleReadOnlyClick}
                onSubmitCapture={handleReadOnlySubmit}
              >
                {isLoading ? (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">
                    Verificando acesso…
                  </div>
                ) : pageAllowed ? (
                  <Outlet />
                ) : (
                  <div className="grid h-full place-items-center p-8 text-center">
                    <div>
                      <h1 className="font-serif text-3xl">Acesso não concedido</h1>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Solicite ao administrador a liberação desta área.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
        <AgendaAlert />
      </div>
    </SidebarProvider>
  );
}
