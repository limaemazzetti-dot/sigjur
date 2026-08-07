// Heurística simples para inferir gênero a partir do primeiro nome (pt-BR).
// Usada como fallback quando o campo `genero` do perfil não está preenchido.

const MALE_EXCEPTIONS = new Set([
  "joao", "joshua", "luca", "noa", "aba", "isaia", "jonas", "elias", "tobias",
  "mateus", "matheus", "andrea", "andre", "jose", "jorge", "vinicius", "marcos",
  "lucas", "thomas", "nicolas", "silas", "cauã", "caua", "iuri", "yuri",
  "davi", "levi", "ravi", "eli", "gabriel", "rafael", "miguel", "daniel",
  "samuel", "manuel", "ismael", "raul", "saul", "cassio", "julio", "fabio",
  "sergio", "otavio", "flavio", "italo", "hugo", "diego", "tiago", "thiago",
  "bento", "enzo", "theo", "ryan", "brian",
]);

const FEMALE_EXCEPTIONS = new Set([
  "beatriz", "isis", "ines", "mercedes", "carmen", "miriam", "raquel",
  "isabel", "abigail", "esther", "ester", "ruth", "judith", "estela",
  "solange", "eliane", "adriane", "eloa", "eloá", "agar",
]);

export function inferGenero(nome?: string | null): "M" | "F" {
  if (!nome) return "F";
  const first = nome
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!first) return "F";
  if (FEMALE_EXCEPTIONS.has(first)) return "F";
  if (MALE_EXCEPTIONS.has(first)) return "M";
  const last = first.slice(-1);
  // Terminações tipicamente femininas
  if (last === "a") return "F";
  if (first.endsWith("ce") || first.endsWith("te") && first.length > 4) {
    // ex.: Alice, Beatrice, Charlotte — poucas ocorrências
    return "F";
  }
  // Padrão: masculino
  return "M";
}
