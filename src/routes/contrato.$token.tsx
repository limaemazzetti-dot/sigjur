import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  consultarLinkPublicoContrato,
  enviarFormularioPublicoContrato,
} from "@/lib/contratos-publicos.functions";
import { downloadBpcLoasKitDocx } from "@/lib/bpc-docx-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/contrato/$token")({ component: ContratoPublicoPage });

const campos = [
  ["nome", "Nome completo *"],
  ["cpf_cnpj", "CPF *"],
  ["rg", "RG"],
  ["data_aniversario", "Data de nascimento"],
  ["nacionalidade", "Nacionalidade"],
  ["profissao", "Profissão"],
  ["telefone", "Telefone"],
  ["email", "E-mail"],
  ["endereco", "Endereço completo *"],
  ["cidade", "Cidade *"],
  ["estado", "UF *"],
  ["cep", "CEP *"],
] as const;

function ContratoPublicoPage() {
  const { token } = Route.useParams();
  const [form, setForm] = useState<Record<string, string>>({ nacionalidade: "brasileira" });
  const link = useQuery({
    queryKey: ["contrato-publico", token],
    queryFn: () => consultarLinkPublicoContrato({ data: { token } }),
    retry: false,
  });
  const enviar = useMutation({
    mutationFn: () => enviarFormularioPublicoContrato({ data: { token, dados: form as never } }),
    onSuccess: async () => {
      await downloadBpcLoasKitDocx(`Kit BPC LOAS - ${form.nome}`, { ...form, tipo: "pf" } as never);
      toast.success("Contrato gerado. Baixe, assine e envie ao escritório.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (link.isLoading)
    return (
      <main className="min-h-screen grid place-items-center p-6">
        Carregando formulário seguro…
      </main>
    );
  if (!link.data)
    return (
      <main className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-serif">Link indisponível</h1>
          <p className="mt-2 text-muted-foreground">
            Este link expirou, foi revogado ou não existe.
          </p>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-muted/30 py-8 px-4">
      <section className="mx-auto max-w-3xl rounded-2xl border bg-background p-5 sm:p-8 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Lima & Mazzetti</p>
        <h1 className="mt-2 font-serif text-3xl">{link.data.nome}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Preencha seus dados. Ao concluir, o documento será gerado para download e assinatura.
        </p>
        <form
          className="mt-7 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            enviar.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {campos.map(([key, label]) => (
              <div key={key} className={key === "endereco" ? "sm:col-span-2" : ""}>
                <Label>{label}</Label>
                <Input
                  required={label.includes("*")}
                  type={key.includes("data") ? "date" : key === "email" ? "email" : "text"}
                  value={form[key] ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <fieldset className="rounded-xl border p-4">
            <legend className="px-1 text-sm font-medium">Representante legal (se houver)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["representante_nome", "Nome"],
                ["representante_cpf", "CPF"],
                ["representante_rg", "RG"],
                ["representante_parentesco", "Parentesco"],
                ["representante_nacionalidade", "Nacionalidade"],
                ["representante_profissao", "Profissão"],
                ["representante_data_nascimento", "Data de nascimento"],
              ].map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type={key.includes("data") ? "date" : "text"}
                    value={form[key] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <Button type="submit" className="w-full" disabled={enviar.isPending}>
            {enviar.isPending ? "Gerando documento…" : "Gerar contrato para baixar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
