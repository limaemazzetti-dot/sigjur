import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDocumentosCliente,
  gerarDocumentosCliente,
  deleteDocumento,
} from "@/lib/documentos.functions";
import { getCliente } from "@/lib/clientes.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Trash2, Copy, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { downloadBpcLoasKitDocx } from "@/lib/bpc-docx-export";

export function DocumentosClienteDialog({
  clienteId,
  clienteNome,
  open,
  onOpenChange,
}: {
  clienteId: string;
  clienteNome: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["documentos-cliente", clienteId],
    queryFn: () => listDocumentosCliente({ data: { cliente_id: clienteId } }),
    enabled: open,
  });

  const cliente = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: () => getCliente({ data: { id: clienteId } }),
    enabled: open,
  });

  const mRegen = useMutation({
    mutationFn: () => gerarDocumentosCliente({ data: { cliente_id: clienteId, replace: true } }),
    onSuccess: (r) => {
      toast.success(`${r.gerados} documento gerado`);
      qc.invalidateQueries({ queryKey: ["documentos-cliente", clienteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => deleteDocumento({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documentos-cliente", clienteId] });
    },
  });

  const documento = list.data?.[0] ?? null;

  async function downloadDocx() {
    try {
      if (!cliente.data) throw new Error("Dados do cliente ainda não carregados.");
      await downloadBpcLoasKitDocx(`Kit BPC LOAS - ${clienteNome}`, cliente.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Kit BPC/LOAS — {clienteNome}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => mRegen.mutate()} disabled={mRegen.isPending}>
            <RefreshCw className="w-4 h-4 mr-2" /> {mRegen.isPending ? "Gerando..." : "Regerar documento"}
          </Button>
        </div>

        {list.isLoading || cliente.isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
        ) : !documento ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum documento gerado. Clique em <em>Regerar documento</em> para criar o Kit BPC/LOAS.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(documento.conteudo); toast.success("Copiado"); }}>
                <Copy className="w-4 h-4 mr-2" /> Copiar texto
              </Button>
              <Button size="sm" onClick={downloadDocx} disabled={!cliente.data}>
                <FileType2 className="w-4 h-4 mr-2" /> Baixar DOCX preenchido
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este documento?")) mDel.mutate(documento.id); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Textarea
              className="font-mono text-sm min-h-[420px]"
              value={documento.conteudo}
              readOnly
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
