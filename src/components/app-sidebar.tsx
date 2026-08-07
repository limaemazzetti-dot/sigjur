import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Wallet,
  FileBarChart,
  BarChart3,
  Users,
  Briefcase,
  UserCog,
  ChevronUp,
  Plug,
  LogOut,
  Gavel,
  CalendarClock,
  ListTree,
  AlarmClock,
  Bell,
  Database,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ManageUsersDialog } from "@/components/manage-users-dialog";
import { AlertasConfigDialog } from "@/components/alertas-config-dialog";
import { getMe, updateUserGenero } from "@/lib/users.functions";
import logoGoldMark from "@/assets/lima-mazzetti-mark-gold.png";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

function accessLevelLabel(level?: string) {
  if (level === "admin") return "Administrador";
  if (level === "editor") return "Editor";
  if (level === "viewer") return "Visualizador";
  return "";
}

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Visão geral",
    items: [
      { title: "Resumo", url: "/resumo", icon: Bell },
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Jurídico",
    items: [
      { title: "Processos", url: "/processos", icon: Briefcase },
      { title: "Audiências", url: "/audiencias", icon: Gavel },
      { title: "Prazos", url: "/prazos", icon: AlarmClock },
      { title: "Perícias", url: "/pericias", icon: CalendarClock },
      { title: "Clientes", url: "/clientes", icon: Users },
      { title: "Modelos", url: "/modelos", icon: FileBarChart },
      { title: "Cadastros", url: "/cadastros", icon: Database },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Lançamentos", url: "/financeiro/lancamentos", icon: Wallet },
      { title: "DRE", url: "/financeiro/dre", icon: FileBarChart },
      { title: "Cadastro de contas", url: "/financeiro/plano-contas", icon: ListTree },
    ],
  },
  {
    label: "Análises",
    items: [{ title: "Business Intelligence", url: "/bi", icon: BarChart3 }],
  },
  {
    label: "Integrações",
    items: [{ title: "Google Sheets", url: "/integracoes", icon: Plug }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const meFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  const initials = (me?.nome ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <Sidebar collapsible="icon" className="dark">
      <SidebarHeader className="border-b border-sidebar-border h-20 justify-center !py-0">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center px-0" : "px-2"}`}>
          {!collapsed && (
            <img
              src={logoGoldMark}
              alt="Lima & Mazzetti Advocacia"
              className="w-12 h-12 object-contain shrink-0"
            />
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base leading-none truncate text-gold-gradient">
                Lima &amp; Mazzetti
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60 mt-1">
                Advocacia
              </p>
            </div>
          )}
          <SidebarTrigger className="shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => {
          const items = g.items.filter((item) => {
            if (me?.isAdmin) return true;
            if (!me?.allowedPages) return false;
            return me.allowedPages.includes(item.url);
          });
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={g.label}>
              {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active =
                      currentPath === item.url || currentPath.startsWith(item.url + "/");
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={item.url} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span>{item.title}</span>}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2 gap-2">
        <UserMenu me={me} collapsed={collapsed} initials={initials} />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu({
  me,
  collapsed,
  initials,
}: {
  me:
    | {
        id?: string;
        nome?: string;
        email?: string;
        roles: string[];
        accessLevel?: "admin" | "editor" | "viewer";
        isAdmin?: boolean;
        genero?: "M" | "F" | null;
      }
    | undefined;
  collapsed: boolean;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [alertasOpen, setAlertasOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const generoFn = useServerFn(updateUserGenero);
  const generoMut = useMutation({
    mutationFn: (genero: "M" | "F") => generoFn({ data: { user_id: me!.id!, genero } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  async function handleSignOut() {
    setOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-sidebar-accent/60 transition-colors group"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight truncate">{me?.email ?? "Carregando..."}</p>
                  <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 truncate">
                    {accessLevelLabel(me?.accessLevel)}
                  </p>
                </div>
                <ChevronUp className="h-4 w-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" sideOffset={8} className="w-64 p-1.5">
          <div className="px-2 py-2 border-b mb-1">
            <p className="text-sm font-medium truncate">{me?.email ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
              {accessLevelLabel(me?.accessLevel)}
            </p>
          </div>

          <div className="px-2 py-2 border-b mb-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              Como devemos te tratar?
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={!me?.id || generoMut.isPending}
                onClick={() => generoMut.mutate("M")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs border transition-colors ${
                  me?.genero === "M"
                    ? "bg-accent/20 border-accent text-accent-foreground"
                    : "border-border hover:bg-accent/10"
                }`}
              >
                Masculino
              </button>
              <button
                type="button"
                disabled={!me?.id || generoMut.isPending}
                onClick={() => generoMut.mutate("F")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs border transition-colors ${
                  me?.genero === "F"
                    ? "bg-accent/20 border-accent text-accent-foreground"
                    : "border-border hover:bg-accent/10"
                }`}
              >
                Feminino
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAlertasOpen(true);
            }}
            className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent/15 hover:text-accent-foreground transition-colors"
          >
            <Bell className="h-4 w-4" />
            Alertas personalizados
          </button>

          {me?.isAdmin && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setUsersOpen(true);
              }}
              className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent/15 hover:text-accent-foreground transition-colors"
            >
              <UserCog className="h-4 w-4" />
              Gerenciar usuários
            </button>
          )}

          <div className="h-px bg-border my-1" />
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </PopoverContent>
      </Popover>

      <AlertasConfigDialog open={alertasOpen} onOpenChange={setAlertasOpen} />

      {/* Gerenciar usuários — dialog controlado */}
      {me?.isAdmin && <ManageUsersDialog open={usersOpen} onOpenChange={setUsersOpen} />}
    </>
  );
}
