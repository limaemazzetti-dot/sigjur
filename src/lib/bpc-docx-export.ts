import templateAsset from "@/assets/kit-bpc-loas-com-representante.docx.asset.json";
import { buildBpcLoasVars, type BpcClienteData } from "@/lib/bpc-loas-kit";

function sanitizeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

function replaceSequential(text: string, pattern: RegExp, next: () => string) {
  return text.replace(pattern, () => next());
}

function fillXml(xml: string, cliente: BpcClienteData) {
  const vars = buildBpcLoasVars(cliente);
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paragraphs = Array.from(doc.getElementsByTagNameNS(namespace, "p"));

  for (const paragraph of paragraphs) {
    const textNodes = Array.from(paragraph.getElementsByTagNameNS(namespace, "t"));
    if (textNodes.length === 0) continue;

    const fullText = textNodes.map((node) => node.textContent ?? "").join("");

    if (/^Cidade,\s*_+/.test(fullText)) {
      textNodes[0].textContent = `${vars.cidade}, ${vars.data_hoje}`;
      textNodes.slice(1).forEach((node) => {
        node.textContent = "";
      });
      continue;
    }

    if (fullText.trim() === "NOME COPLETO" || fullText.trim() === "NOME COMPLETO") {
      textNodes[0].textContent = vars.nome;
      textNodes.slice(1).forEach((node) => {
        node.textContent = "";
      });
      continue;
    }

    if (fullText.includes("CPF/MF sob o n°") && fullText.includes("XXX.XXX.XXX-XX")) {
      for (const node of textNodes) {
        node.textContent = (node.textContent ?? "").replace(/XXX\.XXX\.XXX-XX/g, vars.cpf_cnpj);
      }
      continue;
    }

    if (fullText.includes("27/08/2005") && fullText.includes("nacionalidade")) {
      let nomeIndex = 0;
      let nacionalidadeIndex = 0;
      let profissaoIndex = 0;
      let dataIndex = 0;
      let rgIndex = 0;
      let cpfIndex = 0;

      for (const node of textNodes) {
        let text = node.textContent ?? "";
        text = replaceSequential(text, /NOME/g, () => (nomeIndex++ === 0 ? vars.nome : vars.representante_nome));
        text = replaceSequential(text, /nacionalidade/g, () =>
          nacionalidadeIndex++ === 0 ? vars.nacionalidade : vars.representante_nacionalidade,
        );
        text = replaceSequential(text, /profissão/g, () =>
          profissaoIndex++ === 0 ? vars.profissao : vars.representante_profissao,
        );
        text = replaceSequential(text, /27\/08\/2005/g, () =>
          dataIndex++ === 0 ? vars.data_nascimento : vars.representante_data_nascimento,
        );
        text = replaceSequential(text, /\bxx\.xxx\.xxx-xx\b/g, () =>
          rgIndex++ === 0 ? vars.rg : vars.representante_rg,
        );
        text = replaceSequential(text, /\bxxx\.xxx\.xxx-xx\b/g, () =>
          cpfIndex++ === 0 ? vars.cpf_cnpj : vars.representante_cpf,
        );
        text = text
          .replace(/genitora\/curadora/g, vars.representante_parentesco)
          .replace(/\(endereço completo com bairro cidade e cep\)/g, vars.endereco)
          .replace(/ambas residentes e domiciliadas/g, "ambos(as) residentes e domiciliados(as)")
          .replace(/nascida em/g, "nascido(a) em")
          .replace(/portadora do RG/g, "portador(a) do RG")
          .replace(/inscrita no CPF\/MF/g, "inscrito(a) no CPF/MF");
        node.textContent = text;
      }
      continue;
    }

    for (const node of textNodes) {
      node.textContent = (node.textContent ?? "")
        .replace(/NOME COPLETO/g, vars.nome)
        .replace(/NOME COMPLETO/g, vars.nome)
        .replace(/XXX\.XXX\.XXX-XX/g, vars.cpf_cnpj);
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

export async function downloadBpcLoasKitDocx(nomeArquivo: string, cliente: BpcClienteData) {
  const [{ default: PizZip }, { saveAs }] = await Promise.all([import("pizzip"), import("file-saver")]);
  const response = await fetch(templateAsset.url);
  if (!response.ok) throw new Error("Não foi possível carregar o modelo DOCX original.");

  const zip = new PizZip(await response.arrayBuffer());
  const xmlFiles = Object.keys(zip.files).filter((name) => /^word\/(document|header|footer)\d*\.xml$/.test(name));

  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file) continue;
    zip.file(fileName, fillXml(file.asText(), cliente));
  }

  const blob = zip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  saveAs(blob, `${sanitizeFilename(nomeArquivo)}.docx`);
}