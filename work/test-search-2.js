function normalizeSearch(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function matchesProcessoSearch(processo, rawSearch) {
  const search = normalizeSearch(rawSearch);
  if (!search) return true;
  const numberSearch = search.replace(/\D/g, "");
  const numero = (processo.numero_cnj ?? "").replace(/\D/g, "");
  if (numberSearch && numero.includes(numberSearch)) return true;

  const wantedWords = search.split(/\s+/).filter(Boolean);
  const textWords = normalizeSearch(
    [
      processo.clientes?.nome,
      processo.autor,
      processo.reu,
      processo.outro_envolvido,
      processo.numero_cnj,
      processo.tipo_acao,
      processo.materia,
      processo.area,
      processo.advogado,
    ]
      .filter(Boolean)
      .join(" "),
  )
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  return wantedWords.every((wanted) => textWords.some((word) => word.startsWith(wanted)));
}

const mockProcess = {
  clientes: null,
  autor: "DAVI DA SILVA LIRA",
  reu: "CRISTIANO DOS SANTOS DE LIRA",
  numero_cnj: "1003033-63.2026.8.26.0068",
};

console.log("Matches 'DAV' (no clientes loaded)?", matchesProcessoSearch(mockProcess, "DAV"));
