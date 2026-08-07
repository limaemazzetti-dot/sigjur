
## Objetivo

Fazer a importação de planilhas funcionar de verdade em **Clientes** e **Processos**, aceitando os formatos reais que você usa (CSV separado por `;`, XLSX com datas em `dd/mm/aaaa`, valores em `R$ 1.234,56`, CPF com pontuação etc.) e mostrando exatamente o que deu errado em cada linha.

## Diagnóstico

O componente atual (`src/components/import-planilha-dialog.tsx`) e as chamadas em `clientes.tsx`/`processos.tsx` têm 4 problemas que fazem tudo falhar em silêncio:

1. **Datas em formato brasileiro** (`15/07/2026`) chegam como string ao Zod / Postgres, que espera `YYYY-MM-DD`. Toda linha com data volta como erro.
2. **CSV com `;`** (padrão Excel BR) — hoje só `,` é tratado corretamente pelo `sheet_to_json`.
3. **Erros são engolidos**: o loop faz `catch {}` e só mostra "X erros" no total, sem dizer qual linha ou motivo — por isso "não funciona" sem pista.
4. **Campos numéricos com "R$" / "%"** e **CPF/CNPJ/telefone com máscara** quebram a validação. Em processos há uma limpeza parcial; em clientes não há nenhuma.

Além disso, `cliente_qualificacao`, `honorarios_percentual` (que pode vir como `20` significando 20%) e `numero_cnj` (às vezes numérico) precisam de coerção.

## O que vou mudar

### 1. `src/components/import-planilha-dialog.tsx`
- Detectar delimitador de CSV automaticamente (`,` ou `;`).
- Normalizar datas: aceitar `dd/mm/aaaa`, `dd-mm-aaaa`, ISO, e objetos `Date` → converter tudo para `YYYY-MM-DD` para campos marcados como data.
- Aceitar um segundo mapa opcional `fieldTypes` (`date` | `number` | `string` | `boolean`) e aplicar a coerção correta:
  - `number`: remove `R$`, espaços, troca `.`/`,` no padrão BR.
  - `boolean`: aceita `sim/não/true/false/1/0`.
- Processar em **lotes de 25 linhas em paralelo** (mais rápido, sem estourar o worker).
- Guardar `{ linha, motivo }` de cada falha e listar as 20 primeiras no diálogo ao terminar, com botão "Baixar erros (.csv)".
- Barra de progresso real.

### 2. `src/routes/_authenticated/clientes.tsx`
- Declarar `fieldTypes` com `data_aniversario: "date"`.
- Limpar `cpf_cnpj`, `telefone`, `cep` (só dígitos) antes do upsert.
- Garantir default `tipo: "pf"` e ignorar chaves não presentes no schema Zod.

### 3. `src/routes/_authenticated/processos.tsx`
- Declarar `fieldTypes` para todas as datas (`data_prazo`, `data_inicio`, `data_encerramento`) e todos os valores monetários/percentuais.
- Coerção de `numero_cnj` para string.
- Converter `honorarios_percentual` maior que 1 dividindo por 100 (planilhas costumam ter `20` = 20%).
- Detectar `status` a partir da coluna "Status" quando presente, senão manter `inicial`.

### 4. Feedback ao usuário
- Toast final: "Importados 42 de 50. 8 linhas com erro — veja detalhes".
- Painel de erros dentro do diálogo com linha da planilha + campo problemático.

## Detalhes técnicos

```ts
// helper de data
function toISODate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0,10);
  const s = String(v).trim();
  const br = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return s.slice(0,10);
  const d = new Date(s); return isNaN(+d) ? null : d.toISOString().slice(0,10);
}

// helper numérico BR
function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[R$\s]/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",","."));
  return Number.isFinite(n) ? n : null;
}
```

Lote paralelo:
```ts
for (let i = 0; i < rows.length; i += 25) {
  const batch = rows.slice(i, i+25);
  const results = await Promise.allSettled(batch.map(onImport));
  results.forEach((r, k) => { if (r.status === "rejected") errors.push({ linha: i+k+2, motivo: String(r.reason?.message ?? r.reason) }); });
  setProgress({ done: Math.min(i+25, rows.length), total: rows.length, errors: errors.length });
}
```

Nenhuma alteração de schema no banco — só normalização no front antes de chamar `upsertCliente` / `upsertProcesso`.

## Depois de aplicar

Você poderá arrastar sua planilha original (com `;`, datas `dd/mm/aaaa`, `R$`, CPF com pontos) e ela vai cadastrar tudo. Linhas com problema aparecem listadas com o motivo, sem travar as demais.
