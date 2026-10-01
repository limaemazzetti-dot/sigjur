export type ProcessoPartes = {
  autor: string;
  reu: string;
  autores: string[];
  reus: string[];
};

function cleanValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [];
  return values.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

/**
 * Normaliza o formato atual (arrays JSON) com os campos legados de resumo.
 * Os campos antigos continuam sendo a primeira parte para compatibilidade com
 * registros e integrações antigas, mas nunca podem ocultar as demais partes.
 */
export function normalizeProcessoPartes(row: {
  autor?: unknown;
  reu?: unknown;
  autores?: unknown;
  reus?: unknown;
}): ProcessoPartes {
  const autor = typeof row.autor === "string" ? row.autor.trim() : "";
  const reu = typeof row.reu === "string" ? row.reu.trim() : "";
  const autores = [...new Set([...(autor ? [autor] : []), ...cleanValues(row.autores)])];
  const reus = [...new Set([...(reu ? [reu] : []), ...cleanValues(row.reus)])];
  return {
    autor: autores[0] ?? "",
    reu: reus[0] ?? "",
    autores,
    reus,
  };
}

export function partesLabel(partes: Pick<ProcessoPartes, "autores" | "reus">): string {
  const autores = partes.autores.join(", ");
  const reus = partes.reus.join(", ");
  return [autores && `Autor(es): ${autores}`, reus && `Réu(s): ${reus}`]
    .filter(Boolean)
    .join(" · ");
}
