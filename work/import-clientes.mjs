import fs from "node:fs/promises";

const projectDir = "/Users/thiegojesus/Documents/Codex/2026-07-15/re";
const csvPath = "/Users/thiegojesus/Downloads/CLIENTE/Clie-F-Tabela 1.csv";
const apply = process.env.APPLY === "1";

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim().replace(/^['"]|['"]$/g, "")]),
  );
}

function parseCsv(text, delimiter = ";") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function clean(value) {
  const result = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return result || null;
}

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function birthDate(value) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (match[3].length === 2) year += year <= 26 ? 2000 : 1900;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function timestamp(value) {
  const date = birthDate(value);
  return date ? `${date}T12:00:00.000Z` : null;
}

function documentValue(value) {
  return clean(value);
}

function cepValue(value) {
  const valueDigits = digits(value);
  if (!valueDigits) return null;
  return valueDigits.length <= 8 ? valueDigits.padStart(8, "0") : clean(value);
}

function sourceKey(client) {
  return `${normalized(client.nome)}|${digits(client.cpf_cnpj) || "sem-documento"}`;
}

function mergeText(first, second, separator = "\n") {
  if (!first) return second ?? null;
  if (!second) return first;
  const normalizedFirst = normalized(first);
  const normalizedSecond = normalized(second);
  if (normalizedFirst.includes(normalizedSecond)) return first;
  if (normalizedSecond.includes(normalizedFirst)) return second;
  return `${first}${separator}${second}`;
}

function mergeSource(target, incoming) {
  const merged = { ...target };
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "observacoes") merged[key] = mergeText(merged[key], value);
    else if ((merged[key] == null || merged[key] === "") && value != null && value !== "")
      merged[key] = value;
  }
  merged._sourceLines = [...target._sourceLines, ...incoming._sourceLines];
  return merged;
}

function empty(value) {
  return value == null || String(value).trim() === "";
}

function updatePayload(existing, source) {
  const update = {};
  const fillable = [
    "cpf_cnpj",
    "rg",
    "email",
    "telefone",
    "profissao",
    "data_aniversario",
    "endereco",
    "bairro",
    "cidade",
    "estado",
    "cep",
    "observacoes",
    "nacionalidade",
    "sexo",
    "estado_civil",
    "como_conheceu",
    "senha_gov_br",
  ];
  for (const key of fillable) {
    if (empty(existing[key]) && !empty(source[key])) update[key] = source[key];
    else if (
      key === "observacoes" &&
      !empty(source[key]) &&
      !normalized(existing[key]).includes(normalized(source[key]))
    ) {
      update[key] = mergeText(existing[key], source[key]);
    }
  }
  if (
    !empty(source.created_at) &&
    String(existing.created_at ?? "").slice(0, 10) !== source.created_at.slice(0, 10)
  ) {
    update.created_at = source.created_at;
  }
  return update;
}

const env = parseEnv(await fs.readFile(`${projectDir}/.env`, "utf8"));
const supabaseUrl = env.SUPABASE_URL;
const secretKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !secretKey) throw new Error("Configuração administrativa do Supabase ausente");

async function rest(path, { method = "GET", body, prefer } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${responseText}`);
  return responseText ? JSON.parse(responseText) : null;
}

const csvText = await fs.readFile(csvPath, "utf8");
const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
const headerIndex = rows.findIndex((row) => row.some((cell) => clean(cell) === "Nome"));
if (headerIndex < 0) throw new Error("Cabeçalho de clientes não encontrado");
const header = rows[headerIndex].map((cell) => clean(cell));
const column = Object.fromEntries(
  header.map((name, index) => [name, index]).filter(([name]) => name),
);

const sourceRows = [];
for (let index = headerIndex + 1; index < rows.length; index += 1) {
  const row = rows[index];
  const nome = clean(row[column.Nome]);
  if (!nome) continue;
  sourceRows.push({
    nome,
    tipo: "pf",
    cpf_cnpj: documentValue(row[column.CPF]),
    rg: documentValue(row[column.RG]),
    sexo: clean(row[column.Sexo]),
    data_aniversario: birthDate(row[column["Data de Nascimento"]]),
    telefone: clean(row[column.Telefone]),
    email: clean(row[column["E-mail"]]),
    senha_gov_br: clean(row[column["Senha GOV.BR"]]),
    endereco: clean(row[column["Endereço"]]),
    bairro: clean(row[column.Bairro]),
    cep: cepValue(row[column.CEP]),
    cidade: clean(row[column.Cidade]),
    estado: clean(row[column.Estado]),
    nacionalidade: clean(row[column.Nacionalidade]),
    profissao: clean(row[column["Profissão"]]),
    estado_civil: clean(row[column["Estado Civil"]]),
    como_conheceu: clean(row[column["Como nos Conheceu"]]),
    observacoes: clean(row[column["Observações"]]),
    created_at: timestamp(row[column["Data de Cadastro"]]),
    _sourceLines: [index + 1],
  });
}

const uniqueByKey = new Map();
for (const client of sourceRows) {
  const key = sourceKey(client);
  uniqueByKey.set(key, uniqueByKey.has(key) ? mergeSource(uniqueByKey.get(key), client) : client);
}
const sourceClients = [...uniqueByKey.values()];

const [ownerProfiles, existingClients] = await Promise.all([
  rest("profiles?select=id,email&email=eq.marcelo%40gmail.com"),
  rest("clientes?select=*"),
]);
if (ownerProfiles.length !== 1)
  throw new Error("Usuário proprietário não encontrado de forma única");
const ownerId = ownerProfiles[0].id;

const unmatchedExisting = new Set(existingClients.map((client) => client.id));
const insertRows = [];
const updateRows = [];
for (const source of sourceClients) {
  const sourceCpf = digits(source.cpf_cnpj);
  const sameName = existingClients.filter(
    (client) =>
      unmatchedExisting.has(client.id) && normalized(client.nome) === normalized(source.nome),
  );
  const sameCpfAndName = sameName.find(
    (client) => sourceCpf && digits(client.cpf_cnpj) === sourceCpf,
  );
  const blankCpfSameName = sameName.find((client) => empty(client.cpf_cnpj));
  const existing =
    sameCpfAndName ??
    blankCpfSameName ??
    (sameName.length === 1 && !sourceCpf ? sameName[0] : null);
  if (existing) {
    unmatchedExisting.delete(existing.id);
    const changes = updatePayload(existing, source);
    if (Object.keys(changes).length)
      updateRows.push({ id: existing.id, changes, sourceLines: source._sourceLines });
  } else {
    const { _sourceLines, ...payload } = source;
    if (!payload.created_at) delete payload.created_at;
    insertRows.push({ ...payload, criado_por: ownerId });
  }
}

if (apply) {
  for (const update of updateRows) {
    await rest(`clientes?id=eq.${encodeURIComponent(update.id)}`, {
      method: "PATCH",
      body: update.changes,
      prefer: "return=minimal",
    });
  }
  for (let index = 0; index < insertRows.length; index += 100) {
    await rest("clientes", {
      method: "POST",
      body: insertRows.slice(index, index + 100),
      prefer: "return=minimal",
    });
  }
}

const finalClients = apply ? await rest("clientes?select=id,nome,cpf_cnpj") : existingClients;
const summary = {
  mode: apply ? "apply" : "dry-run",
  source_rows: sourceRows.length,
  unique_source_clients: sourceClients.length,
  duplicate_source_rows_merged: sourceRows.length - sourceClients.length,
  existing_clients_before: existingClients.length,
  existing_clients_to_complete: updateRows.length,
  new_clients_to_insert: insertRows.length,
  final_clients: finalClients.length,
};
if (process.env.DEBUG_NAMES === "1") {
  summary.unmatched_existing_names = existingClients
    .filter((client) => unmatchedExisting.has(client.id))
    .map((client) => client.nome);
  summary.new_client_names = insertRows.map((client) => client.nome);
}
console.log(JSON.stringify(summary, null, 2));
