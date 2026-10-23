/** Ordena por nome em ordem alfabética (pt-BR, sem diferenciar maiúsculas/acentos). */
export const compareByName = (a: { name?: string | null }, b: { name?: string | null }) =>
  (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" });
