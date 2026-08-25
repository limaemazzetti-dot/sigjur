import fs from "node:fs/promises";
import * as XLSX from "xlsx";

const projectDir = "/Users/thiegojesus/Documents/Codex/2026-07-15/re";
const csvPath = "/tmp/processos.csv";
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

function clean(value) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanIdentifier(value) {
  const text = clean(value);
  if (!text) return null;
  return /^\d+\.0$/.test(text) ? text.slice(0, -2) : text;
}

function cleanFolder(value) {
  const text = clean(value);
  if (!text) return null;
  return /^\d+\.0$/.test(text) ? text.slice(0, -2) : text;
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value)
    .trim()
    .replace(/[R$%\s]/g, "");
  if (!text) return null;
  if (text.includes(",") && text.includes(".")) text = text.replace(/\./g, "").replace(",", ".");
  else if (text.includes(",")) text = text.replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentageOrNull(value) {
  const parsed = numberOrNull(value);
  if (parsed == null) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function dateOrNull(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf()))
    return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    const first = Number(br[1]);
    const second = Number(br[2]);
    const monthFirst = first <= 12 && second > 12;
    const month = monthFirst ? first : second;
    const day = monthFirst ? second : first;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function boolOrNull(value) {
  const text = normalized(value);
  if (["sim", "s", "true", "1"].includes(text)) return true;
  if (["nao", "n", "false", "0"].includes(text)) return false;
  return null;
}

function processStatus(value) {
  const text = normalized(value);
  if (text.includes("deferido") || text.includes("procedente")) return "julgado_procedente";
  if (text.includes("improcedente")) return "julgado_improcedente";
  if (text.includes("execucao")) return "execucao";
  if (text.includes("recurso")) return "recurso";
  if (text.includes("conclus")) return "concluso_sentenca";
  if (text.includes("suspens")) return "suspenso";
  if (text.includes("arquivad")) return "arquivado";
  if (text.includes("acordo")) return "acordo";
  if (text.includes("ativo")) return "em_andamento";
  return "inicial";
}

function sameSideRepresentative(qualification, clientQualification) {
  const other = normalized(qualification);
  const client = normalized(clientQualification);
  return (
    client.includes("menor") ||
    ["mae", "pai", "representante", "responsavel", "procurador"].includes(other)
  );
}

function rowKey(row) {
  const number = normalized(row.numero_cnj);
  const client = normalized(row.cliente_nome);
  if (number) return `${number}|${client}`;
  return `${normalized(row.tipo_acao)}|${client}|${row.data_inicio ?? ""}`;
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
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const csvText = await fs.readFile(csvPath, "utf8");
const workbook = XLSX.read(csvText, { type: "string", cellDates: true, raw: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  defval: null,
  raw: true,
  blankrows: false,
});
const headerIndex = rows.findIndex((row) => row.some((cell) => clean(cell) === "Nº do Processo"));
if (headerIndex < 0) throw new Error("Cabeçalho da planilha não encontrado");

const parsedRows = [];
for (let index = headerIndex + 1; index < rows.length; index += 1) {
  const row = rows[index];
  const clienteNome = clean(row[8]);
  const numeroCnj = cleanIdentifier(row[4]);
  const tipoAcao = clean(row[5]);
  const outroEnvolvido = clean(row[14]);
  if (!clienteNome && !numeroCnj && !tipoAcao && !outroEnvolvido) continue;
  if (!clienteNome) throw new Error(`Linha ${index + 1} sem cliente`);

  const clienteQualificacao = clean(row[9]);
  const outroQualificacao = clean(row[15]);
  const otherIsRepresentative = sameSideRepresentative(outroQualificacao, clienteQualificacao);
  const otherParty = otherIsRepresentative ? null : outroEnvolvido;
  const clientIsDefendant = ["reu", "requerido", "reclamado"].some((role) =>
    normalized(clienteQualificacao).includes(role),
  );

  parsedRows.push({
    source_line: index + 1,
    cliente_nome: clienteNome,
    cliente_tipo: normalized(row[7]).includes("juridica") ? "pj" : "pf",
    numero_cnj: numeroCnj,
    pasta: cleanFolder(row[2]),
    autor: clientIsDefendant ? (otherParty ?? "—") : clienteNome,
    reu: clientIsDefendant ? clienteNome : (otherParty ?? "—"),
    status: processStatus(row[3]),
    materia: clean(row[6]),
    tipo_acao: tipoAcao,
    instancia: clean(row[24]),
    area: clean(row[6]),
    fase: clean(row[23]),
    tipo: clean(row[22]),
    advogado: clean(row[13]),
    vara: clean(row[26]),
    tribunal: null,
    comarca: clean(row[25]),
    data_protocolo: null,
    data_inicio: dateOrNull(row[28]),
    data_encerramento: dateOrNull(row[29]),
    prazo_em_aberto: boolOrNull(row[10]) ?? false,
    data_prazo: dateOrNull(row[11]),
    detalhes_prazo: clean(row[12]),
    origem: null,
    valor_causa: numberOrNull(row[16]),
    valor_acordo: numberOrNull(row[17]),
    honorarios_valor: numberOrNull(row[18]),
    honorarios_percentual: percentageOrNull(row[19]),
    sucumbencias_percentual: percentageOrNull(row[20]),
    sucumbencias_valor: null,
    cliente_qualificacao: clienteQualificacao,
    outro_envolvido: outroEnvolvido,
    outro_envolvido_qualificacao: outroQualificacao,
    link_processo: clean(row[32]),
    link_pasta: clean(row[33]),
    resultado: clean(row[31]),
    observacoes: clean(row[27]),
  });
}

const sourceByKey = new Map();
const duplicateSourceRows = [];
for (const row of parsedRows) {
  const key = rowKey(row);
  if (sourceByKey.has(key)) duplicateSourceRows.push(row.source_line);
  else sourceByKey.set(key, row);
}
const uniqueSourceRows = [...sourceByKey.values()];

const [ownerProfiles, existingClients, existingProcesses] = await Promise.all([
  rest("profiles?select=id,email&email=eq.marcelo%40gmail.com"),
  rest("clientes?select=id,nome,tipo"),
  rest("processos?select=id,numero_cnj,tipo_acao,data_inicio,cliente_id,autor"),
]);
if (ownerProfiles.length !== 1)
  throw new Error("Usuário proprietário não encontrado de forma única");
const ownerId = ownerProfiles[0].id;

const clientsByName = new Map(existingClients.map((client) => [normalized(client.nome), client]));
const clientsToInsert = [];
for (const row of uniqueSourceRows) {
  const key = normalized(row.cliente_nome);
  if (!clientsByName.has(key)) {
    const client = { nome: row.cliente_nome, tipo: row.cliente_tipo, criado_por: ownerId };
    clientsByName.set(key, client);
    clientsToInsert.push(client);
  }
}

const existingClientNameById = new Map(existingClients.map((client) => [client.id, client.nome]));
const existingProcessKeys = new Set(
  existingProcesses.map((process) => {
    const clientName = existingClientNameById.get(process.cliente_id) ?? process.autor;
    return rowKey({
      numero_cnj: process.numero_cnj,
      cliente_nome: clientName,
      tipo_acao: process.tipo_acao,
      data_inicio: process.data_inicio,
    });
  }),
);
const newSourceRows = uniqueSourceRows.filter((row) => !existingProcessKeys.has(rowKey(row)));

const summary = {
  apply,
  source_rows: parsedRows.length,
  duplicate_source_rows_skipped: duplicateSourceRows,
  unique_processes_in_source: uniqueSourceRows.length,
  existing_clients: existingClients.length,
  clients_to_insert: clientsToInsert.length,
  existing_processes: existingProcesses.length,
  processes_to_insert: newSourceRows.length,
  open_deadlines_with_date: newSourceRows.filter((row) => row.prazo_em_aberto && row.data_prazo)
    .length,
};

if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

if (clientsToInsert.length > 0) {
  const insertedClients = await rest("clientes", {
    method: "POST",
    body: clientsToInsert,
    prefer: "return=representation",
  });
  for (const client of insertedClients) clientsByName.set(normalized(client.nome), client);
}

const processPayloads = newSourceRows.map((row) => {
  const client = clientsByName.get(normalized(row.cliente_nome));
  if (!client?.id) throw new Error(`Cliente não resolvido: ${row.cliente_nome}`);
  const { source_line, cliente_nome, cliente_tipo, ...process } = row;
  return { ...process, cliente_id: client.id, criado_por: ownerId };
});

if (processPayloads.length > 0) {
  await rest("processos", {
    method: "POST",
    body: processPayloads,
    prefer: "return=minimal",
  });
}

const [finalClients, finalProcesses] = await Promise.all([
  rest("clientes?select=id"),
  rest("processos?select=id"),
]);
console.log(
  JSON.stringify(
    { ...summary, final_clients: finalClients.length, final_processes: finalProcesses.length },
    null,
    2,
  ),
);
