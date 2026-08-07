import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { syncModulos } from "@/lib/google-sheets.functions";

type Modulo = "painel" | "processos" | "clientes" | "lancamentos" | "dre";

// Debounce compartilhado por módulo (tolerância de 5s pedida pelo usuário).
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Set<Modulo>();

/**
 * Retorna uma função `trigger(modulos)` que agenda uma sincronização
 * com as planilhas configuradas para aqueles módulos, aguardando até
 * 5s para agrupar mudanças próximas.
 */
export function useAutoSync() {
  const runFn = useServerFn(syncModulos);
  const runRef = useRef(runFn);
  runRef.current = runFn;

  useEffect(() => {
    return () => {
      // não cancela: deixa o timer disparar mesmo após unmount, para
      // que a última mudança sempre seja enviada.
    };
  }, []);

  return (modulos: Modulo[]) => {
    for (const m of modulos) pending.add(m);
    const key = "__all__";
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      const list = Array.from(pending) as Modulo[];
      pending.clear();
      timers.delete(key);
      if (list.length === 0) return;
      void runRef.current({ data: { modulos: list } }).catch(() => {
        // silencioso: já existe botão manual de sincronizar em /integrações
      });
    }, 5000);
    timers.set(key, t);
  };
}
