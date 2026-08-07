export type BpcClienteData = {
  nome: string;
  tipo?: "pf" | "pj";
  cpf_cnpj: string | null;
  rg: string | null;
  email?: string | null;
  telefone?: string | null;
  profissao: string | null;
  nacionalidade: string | null;
  data_aniversario: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  representante_nome: string | null;
  representante_nacionalidade: string | null;
  representante_profissao: string | null;
  representante_data_nascimento: string | null;
  representante_rg: string | null;
  representante_cpf: string | null;
  representante_parentesco: string | null;
};

const BLANK = "___________";

function value(v: string | null | undefined, fallback = BLANK) {
  const trimmed = (v ?? "").trim();
  return trimmed || fallback;
}

export function formatBpcDate(v: string | null | undefined) {
  if (!v) return BLANK;
  return new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR");
}

export function buildBpcLoasVars(c: BpcClienteData) {
  const cidade = value(c.cidade, "Cidade");
  const estado = value(c.estado, "UF");
  const cep = value(c.cep);
  const enderecoBase = value(c.endereco);
  const enderecoCompleto = [enderecoBase, cidade, estado, cep !== BLANK ? `CEP ${cep}` : ""]
    .filter((part) => part && part !== BLANK)
    .join(", ") || BLANK;

  return {
    nome: value(c.nome),
    nacionalidade: value(c.nacionalidade, "brasileira"),
    profissao: value(c.profissao),
    data_nascimento: formatBpcDate(c.data_aniversario),
    rg: value(c.rg),
    cpf_cnpj: value(c.cpf_cnpj),
    email: value(c.email),
    telefone: value(c.telefone),
    endereco: enderecoCompleto,
    cidade,
    estado,
    cep,
    data_hoje: new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    representante_nome: value(c.representante_nome),
    representante_nacionalidade: value(c.representante_nacionalidade, "brasileira"),
    representante_profissao: value(c.representante_profissao),
    representante_data_nascimento: formatBpcDate(c.representante_data_nascimento),
    representante_rg: value(c.representante_rg),
    representante_cpf: value(c.representante_cpf),
    representante_parentesco: value(c.representante_parentesco, "representante legal"),
  };
}

function qualificacao(c: BpcClienteData) {
  const v = buildBpcLoasVars(c);
  return `${v.nome}, ${v.nacionalidade}, ${v.profissao}, nascido(a) em ${v.data_nascimento}, portador(a) do RG sob o n° ${v.rg}, inscrito(a) no CPF/MF sob o n° ${v.cpf_cnpj}, representado(a) neste ato por sua ${v.representante_parentesco} ${v.representante_nome}, ${v.representante_nacionalidade}, ${v.representante_profissao}, nascido(a) em ${v.representante_data_nascimento}, portador(a) do RG sob o n° ${v.representante_rg}, inscrito(a) no CPF/MF sob o n° ${v.representante_cpf}, ambos(as) residentes e domiciliados(as) na ${v.endereco}`;
}

export function renderBpcLoasKitText(c: BpcClienteData) {
  const v = buildBpcLoasVars(c);
  const q = qualificacao(c);
  const assinatura = `${v.nome}\nCPF/MF sob o n° ${v.cpf_cnpj}`;

  return `PROCURAÇÃO AD JUDICIA ET EXTRA

OUTORGANTE: ${q}

OUTORGADOS: Dra. YASMIN MAZZETTI, advogada, inscrita na OAB/SP sob o nº 461.096 e Dr. LUIS MARCELO BOLO LIMA, advogado, inscrito na OAB/SP sob o n° 549.037, ambos com sede à Calçada das Bétulas, 97 - Loja 2 - Alphaville - Barueri - SP, 06453-045, com endereço eletrônico yasminmazzetti@adv.oabsp.org.br.

Poderes gerais e ad judicia: Os outorgados têm poderes para representá-lo judicial e extrajudicialmente, no foro em geral, podendo atuar em qualquer instância ou tribunal e praticar todos os atos necessários à defesa dos interesses do outorgante.

Poderes especiais: Prestar declarações de insuficiência econômico-financeira, requerer dispensa de custas, renunciar ao montante que ultrapasse o teto dos Juizados Especiais, firmar acordos, receber valores, dar quitação e substabelecer.

${v.cidade}, ${v.data_hoje}

_____________________________________________________________
${assinatura}

\f
DECLARAÇÃO DE HIPOSSUFICIÊNCIA

Eu, ${q}, venho declarar que, em razão de minha atual condição financeira, não tenho condições de arcar com nenhum tipo de pagamento de custos processuais, sob pena de implicar em prejuízo próprio e de minha família, nos termos do Art. 5, LXXIV, da Constituição da República, da Lei n° 1.060/50, bem como nos artigos 82 e 98 do Novo Código de Processo Civil.

Reiterando minha incapacidade de custear quaisquer ações, solicito que tal benefício abranja todos os atos do processo.

${v.cidade}, ${v.data_hoje}

_____________________________________________________________
${assinatura}

\f
TERMO DE REPRESENTAÇÃO E AUTORIZAÇÃO DE ACESSO A INFORMAÇÕES PREVIDENCIÁRIAS
(PORTARIA PRES/INSS Nº 1.538, DE 19 DE DEZEMBRO DE 2022)

OUTORGANTE: ${q}

OUTORGADOS: Dra. YASMIN MAZZETTI, advogada, inscrita na OAB/SP sob o nº 461.096 e Dr. LUIS MARCELO BOLO LIMA, advogado, inscrito na OAB/SP sob o n° 549.037.

Os outorgados têm PODERES ESPECÍFICOS para representar o outorgante perante o INSS na solicitação de Benefício de Prestação Continuada – BPC/LOAS e são autorizados a acessar as informações pessoais necessárias ao requerimento.

${v.cidade}, ${v.data_hoje}

_____________________________________________________________
${assinatura}

\f
CONTRATO DE HONORÁRIOS

CONTRATANTE: ${q}

CONTRATADO: LUIS MARCELO BOLO LIMA, advogado, inscrito na OAB/SP sob o n° 549.037, com sede à Calçada das Bétulas, 97 - Loja 2 - Alphaville - Barueri - SP, 06453-045, com endereço eletrônico limaemazzetti@gmail.com.

CLÁUSULA PRIMEIRA – DO OBJETO
O presente contrato tem por objeto a prestação de serviços advocatícios para procedimento administrativo e/ou ação judicial referente ao Benefício de Prestação Continuada – BPC/LOAS, em face do Instituto Nacional do Seguro Social – INSS.

CLÁUSULA SEGUNDA – DOS HONORÁRIOS
Somente em caso de êxito na ação ou procedimento administrativo, o(a) CONTRATANTE pagará 30% sobre os valores recebidos a título de atrasados e/ou condenação.

CLÁUSULA TERCEIRA – DAS CONDIÇÕES DE PAGAMENTO
Fica autorizado o destaque dos honorários contratuais diretamente dos valores recebidos pela parte, nos termos do art. 22, §4º, da Lei nº 8.906/94.

CLÁUSULA QUARTA – DAS DESPESAS
A remuneração acordada não inclui despesas processuais ou administrativas, que deverão ser antecipadas ou reembolsadas pela CONTRATANTE.

CLÁUSULA QUINTA – DAS RESPONSABILIDADES DAS PARTES
O(A) CONTRATANTE reconhece que a atuação da ADVOGADA é de meio e não de resultado, inexistindo qualquer garantia de êxito.

CLÁUSULAS SEXTA A DÉCIMA TERCEIRA
Permanecem aplicáveis as disposições sobre segurança, comunicações, obrigações do(a) contratante, revisão contratual, negócios processuais, rescisão, natureza alimentar dos honorários e disposições gerais constantes no modelo original.

${v.cidade}, ${v.data_hoje}

_____________________________________________________________
${assinatura}

______________________________________________
LUIS MARCELO BOLO LIMA
OAB/SP 549.037

____________________________________________________
TESTEMUNHA

____________________________________________________
TESTEMUNHA

\f
CONTRATO DE HONORÁRIOS – ADITIVO –

${q}

Pelo presente aditivo, ficam ratificadas as condições de contratação, honorários e obrigações previstas no contrato principal referente ao BPC/LOAS.

${v.cidade}, ${v.data_hoje}

_____________________________________________________________
${assinatura}

\f
TERMO DE RENÚNCIA

Eu, ${q}, declaro estar ciente dos termos de renúncia constantes do modelo original, especialmente quanto aos limites de valores e poderes necessários para atuação no benefício BPC/LOAS.

${v.cidade}, ${v.data_hoje}

_____________________________________________________________
${assinatura}
`;
}