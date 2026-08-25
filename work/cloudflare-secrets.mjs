import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].trim().replace(/^['"]|['"]$/g, "")]),
);

const required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) {
  if (!env[key]) throw new Error(`Variável ausente: ${key}`);
}

process.stdout.write(JSON.stringify(Object.fromEntries(required.map((key) => [key, env[key]]))));
