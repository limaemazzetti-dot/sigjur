import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AgendaItem = {
  id: string;
  tipo: "prazo" | "audiencia" | "pericia" | "aniversario";
  titulo: string;
  subtitulo: string | null;
  data: string; // ISO yyyy-mm-dd
  prioridade?: "baixa" | "media" | "alta";
  diasRestantes: number;
};

export const agendaProxima = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const inFar = new Date(today); inFar.setDate(inFar.getDate() + 365);

    const items: AgendaItem[] = [];

    // Prazos em aberto (inclui vencidos + próximos 12 meses)
    const { data: prazos } = await context.supabase
      .from("prazos" as never)
      .select("id, titulo, descricao, data_prazo, prioridade, processo_id, processos(autor, reu)")
      .eq("status", "aberto")
      .lte("data_prazo", iso(inFar));
    for (const p of ((prazos ?? []) as unknown as Array<{
      id: string; titulo: string; descricao: string | null; data_prazo: string;
      prioridade: "baixa"|"media"|"alta"; processo_id: string | null;
      processos: { autor: string; reu: string } | null;
    }>)) {
      const d = new Date(p.data_prazo + "T00:00:00");
      const dias = Math.round((d.getTime() - today.getTime()) / 86400000);
      const isAudiencia = /audi[êe]ncia/i.test(p.titulo) || /audi[êe]ncia/i.test(p.descricao ?? "");
      const isPericia = /per[íi]cia/i.test(p.titulo) || /per[íi]cia/i.test(p.descricao ?? "");
      items.push({
        id: p.id,
        tipo: isPericia ? "pericia" : isAudiencia ? "audiencia" : "prazo",
        titulo: p.titulo,
        subtitulo: p.processos ? `${p.processos.autor} × ${p.processos.reu}` : p.descricao,
        data: p.data_prazo,
        prioridade: p.prioridade,
        diasRestantes: dias,
      });
    }

    // Aniversários / perícias próximas (7 dias)
    const { data: clientes } = await context.supabase
      .from("clientes" as never)
      .select("id, nome, data_aniversario");
    for (const c of ((clientes ?? []) as unknown as Array<{ id: string; nome: string; data_aniversario: string | null }>)) {
      if (!c.data_aniversario) continue;
      const m = c.data_aniversario.slice(5); // MM-DD
      const thisYear = new Date(`${today.getFullYear()}-${m}T00:00:00`);
      const target = thisYear < today ? new Date(`${today.getFullYear() + 1}-${m}T00:00:00`) : thisYear;
      const dias = Math.round((target.getTime() - today.getTime()) / 86400000);
      if (dias >= 0 && dias <= 7) {
        items.push({
          id: c.id,
          tipo: "aniversario",
          titulo: `Aniversário — ${c.nome}`,
          subtitulo: "Cliente cadastrado",
          data: iso(target),
          diasRestantes: dias,
        });
      }
    }

    items.sort((a, b) => a.diasRestantes - b.diasRestantes);
    return {
      items,
      resumo: {
        vencidos: items.filter((i) => i.diasRestantes < 0).length,
        hoje: items.filter((i) => i.diasRestantes === 0).length,
        amanha: items.filter((i) => i.diasRestantes === 1).length,
        proximos7: items.filter((i) => i.diasRestantes >= 0 && i.diasRestantes <= 7).length,
      },
    };
  });

export const biProcessos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("processos" as never)
      .select("id, status, materia");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; status: string; materia: string | null }>;
    const byStatus = new Map<string, number>();
    const byMateria = new Map<string, number>();
    for (const r of rows) {
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
      const m = r.materia?.trim() || "Não informada";
      byMateria.set(m, (byMateria.get(m) ?? 0) + 1);
    }
    const encerrados = rows.filter((r) => r.status === "julgado_procedente" || r.status === "julgado_improcedente");
    const procedentes = encerrados.filter((r) => r.status === "julgado_procedente").length;
    const taxaSucesso = encerrados.length > 0 ? (procedentes / encerrados.length) * 100 : 0;
    return {
      total: rows.length,
      status: Array.from(byStatus.entries()).map(([name, value]) => ({ name, value })),
      materia: Array.from(byMateria.entries()).map(([name, value]) => ({ name, value })),
      encerrados: encerrados.length,
      procedentes,
      improcedentes: encerrados.length - procedentes,
      taxaSucesso,
    };
  });

export const biFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // fim é exclusivo → soma 1 dia para inclusivo
    const fimDate = new Date(data.fim + "T00:00:00");
    fimDate.setDate(fimDate.getDate() + 1);
    const endExclusive = fimDate.toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("lancamentos" as never)
      .select("data, tipo, valor, tipo_honorario, status")
      .gte("data", data.inicio)
      .lt("data", endExclusive)
      .eq("status", "pago");
    if (error) throw new Error(error.message);
    type L = { data: string; tipo: "entrada" | "saida"; valor: number; tipo_honorario: string | null };
    const items = (rows ?? []) as unknown as L[];

    // Buckets mensais entre inicio e fim
    const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const buckets = new Map<string, { chave: string; nome: string; receita: number; despesa: number }>();
    const start = new Date(data.inicio + "T00:00:00");
    const end = new Date(data.fim + "T00:00:00");
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const chave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const nome = `${MESES[cursor.getMonth()]}/${String(cursor.getFullYear()).slice(2)}`;
      buckets.set(chave, { chave, nome, receita: 0, despesa: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const honorarios = new Map<string, number>();
    let receitaTotal = 0;
    let despesaTotal = 0;
    for (const l of items) {
      const chave = l.data.slice(0, 7);
      const bucket = buckets.get(chave);
      const v = Number(l.valor);
      if (l.tipo === "entrada") {
        if (bucket) bucket.receita += v;
        receitaTotal += v;
        if (l.tipo_honorario) {
          honorarios.set(l.tipo_honorario, (honorarios.get(l.tipo_honorario) ?? 0) + v);
        }
      } else {
        if (bucket) bucket.despesa += v;
        despesaTotal += v;
      }
    }
    return {
      mensal: Array.from(buckets.values()),
      honorarios: Array.from(honorarios.entries()).map(([name, value]) => ({ name, value })),
      receitaTotal,
      despesaTotal,
    };
  });
