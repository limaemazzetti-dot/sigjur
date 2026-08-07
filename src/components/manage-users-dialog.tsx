import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listUsers,
  createUser,
  updateUserRole,
  deleteUser,
  updateUserGenero,
  getUserPages,
  setUserPages,
} from "@/lib/users.functions";
import { ALL_PAGES } from "@/lib/permissions";

type AccessLevel = "admin" | "editor" | "viewer";
type Genero = "M" | "F";

export function ManageUsersDialog({
  trigger,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? (openProp as boolean) : openState;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenState(v);
    onOpenChange?.(v);
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("editor");
  const [genero, setGenero] = useState<Genero>("F");

  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUserRole);
  const deleteFn = useServerFn(deleteUser);
  const generoFn = useServerFn(updateUserGenero);
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: (payload: {
      email: string;
      password: string;
      access_level: AccessLevel;
      genero: Genero;
    }) => createFn({ data: payload }),
    onSuccess: () => {
      toast.success("Acesso criado");
      setEmail("");
      setPassword("");
      setAccessLevel("editor");
      setGenero("F");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generoMut = useMutation({
    mutationFn: (p: { user_id: string; genero: Genero }) => generoFn({ data: p }),
    onSuccess: () => {
      toast.success("Gênero atualizado");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (p: { user_id: string; access_level: AccessLevel }) => updateFn({ data: p }),
    onSuccess: () => {
      toast.success("Nível de acesso atualizado");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar acessos por e-mail</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A entrada na plataforma é feita somente pelo e-mail cadastrado e pela senha.
        </p>

        <form
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-md p-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({ email, password, access_level: accessLevel, genero });
          }}
        >
          <div className="sm:col-span-2 flex items-center gap-2 text-sm font-medium">
            <UserPlus className="w-4 h-4" /> Conceder novo acesso
          </div>
          <div className="space-y-1">
            <Label>E-mail de acesso</Label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@exemplo.com"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Senha provisória</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Nível de acesso</Label>
            <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as AccessLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {accessLevel === "admin"
                ? "Acesso total, inclusive gerenciamento de usuários."
                : accessLevel === "editor"
                  ? "Pode consultar, cadastrar e alterar informações."
                  : "Pode somente consultar e exportar informações."}
            </p>
          </div>
          <div className="space-y-1">
            <Label>Gênero</Label>
            <Select value={genero} onValueChange={(v) => setGenero(v as Genero)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Feminino</SelectItem>
                <SelectItem value="M">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Criando acesso..." : "Conceder acesso"}
            </Button>
          </DialogFooter>
        </form>

        <div className="max-h-72 overflow-auto border rounded-md divide-y">
          {users.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>
          )}
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 p-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{u.email}</div>
                {u.nome && u.nome !== u.email && (
                  <div className="truncate text-xs text-muted-foreground">{u.nome}</div>
                )}
              </div>
              <Select
                value={(u.genero as Genero) ?? "F"}
                onValueChange={(v) => generoMut.mutate({ user_id: u.id, genero: v as Genero })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={(u.access_level as AccessLevel) ?? "viewer"}
                onValueChange={(v) =>
                  updateMut.mutate({ user_id: u.id, access_level: v as AccessLevel })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
              <UserPagesButton userId={u.id} isAdminUser={u.access_level === "admin"} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm(`Excluir o acesso de ${u.email}?`)) deleteMut.mutate(u.id);
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserPagesButton({ userId, isAdminUser }: { userId: string; isAdminUser: boolean }) {
  const [open, setOpen] = useState(false);
  const getFn = useServerFn(getUserPages);
  const setFn = useServerFn(setUserPages);
  const qc = useQueryClient();
  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["user-pages", userId],
    queryFn: () => getFn({ data: { user_id: userId } }),
    enabled: open && !isAdminUser,
  });
  const [selected, setSelected] = useState<string[] | null>(null);
  const current = selected ?? pages;

  const saveMut = useMutation({
    mutationFn: (pgs: string[]) => setFn({ data: { user_id: userId, pages: pgs } }),
    onSuccess: () => {
      toast.success("Acessos atualizados");
      qc.invalidateQueries({ queryKey: ["user-pages", userId] });
      qc.invalidateQueries({ queryKey: ["me"] });
      setOpen(false);
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (path: string) => {
    const base = selected ?? pages;
    setSelected(base.includes(path) ? base.filter((p) => p !== path) : [...base, path]);
  };

  const grouped = ALL_PAGES.reduce<Record<string, typeof ALL_PAGES>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSelected(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1" title="Acessos por aba">
          <Shield className="w-4 h-4" />
          Acessos
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 max-h-96 overflow-auto">
        {isAdminUser ? (
          <p className="text-xs text-muted-foreground">
            Administradores têm acesso a todas as abas.
          </p>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <p className="text-xs font-medium mb-2">Abas liberadas</p>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  {group}
                </p>
                <div className="space-y-1.5">
                  {items.map((p) => (
                    <label key={p.path} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={current.includes(p.path)}
                        onCheckedChange={() => toggle(p.path)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button
              size="sm"
              className="w-full mt-2"
              disabled={saveMut.isPending || selected === null}
              onClick={() => saveMut.mutate(current)}
            >
              Salvar
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
