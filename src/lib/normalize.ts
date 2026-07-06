export function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const normalizeText = norm;

export function strongNorm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

// termos genéricos que não distinguem empresas
const STOPWORDS_EMPRESA = new Set([
  "construtora","construtoras","incorporadora","incorporadoras","incorporacoes","incorporacao",
  "empreendimentos","empreendimento","engenharia","construcao","construcoes","participacoes",
  "desenvolvimento","imobiliario","imobiliaria","realty","group","grupo","holding",
  "ltda","me","epp","eireli","sa","s","cia","companhia","e","de","do","da","dos","das"
]);

export function coreTokens(nome: string): string[] {
  return strongNorm(nome).split(" ").filter((t) => t.length > 1 && !STOPWORDS_EMPRESA.has(t));
}

// nomes compatíveis: iguais, iguais sem espaços, ou os tokens-núcleo do menor cabem no maior
export function nomesCompativeis(a: string, b: string): boolean {
  const na = strongNorm(a), nb = strongNorm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.replace(/ /g, "") === nb.replace(/ /g, "")) return true;
  const ca = coreTokens(a), cb = coreTokens(b);
  if (!ca.length || !cb.length) return false;
  const menor = ca.length <= cb.length ? ca : cb;
  const maior = new Set(ca.length <= cb.length ? cb : ca);
  return menor.every((t) => maior.has(t));
}

// resolve UM código por nome: exato vence; senão compatível ÚNICO; se vários -> ambíguo
export function resolverCodigo<T>(
  nome: string,
  candidatos: T[],
  getNome: (c: T) => string,
  getCodigo: (c: T) => string
): { codigo: string; ambiguo: boolean } {
  const alvo = strongNorm(nome || "");
  if (!alvo) return { codigo: "", ambiguo: false };
  const exato = candidatos.find((c) => strongNorm(getNome(c)) === alvo);
  if (exato) return { codigo: getCodigo(exato), ambiguo: false };
  const compat = candidatos.filter((c) => nomesCompativeis(nome, getNome(c)));
  if (compat.length === 1) return { codigo: getCodigo(compat[0]), ambiguo: false };
  return { codigo: "", ambiguo: compat.length > 1 };
}

