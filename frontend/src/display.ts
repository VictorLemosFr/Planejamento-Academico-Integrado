import type { Course } from "./types";

// Palavras que ficam minúsculas no meio do nome e siglas que ficam como estão.
const SMALL = new Set(
  "a à às ao aos as o os e de da das do dos em na nas no nos para por com p/".split(
    " ",
  ),
);
const KEEP = new Set([
  "SI",
  "IA",
  "TI",
  "CD",
  "IHC",
  "UFPE",
  "CIN",
  "LIBRAS",
  "SO",
  "TCC",
]);

function capitalize(word: string) {
  return word
    .split("-")
    .map((part) =>
      // "(cc)" vira "(Cc)": a primeira letra, não o primeiro caractere.
      part.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR")),
    )
    .join("-");
}

/**
 * As páginas do CIn publicam CC, EC e IA em CAIXA ALTA. Só a exibição é convertida;
 * os dados continuam iguais à fonte.
 */
export function titleCase(text: string) {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 4 || text !== text.toLocaleUpperCase("pt-BR"))
    return text;
  return text
    .split(/(\s+)/)
    .map((token, index) => {
      if (/^\s+$/.test(token)) return token;
      if (KEEP.has(token) || /^[IVX]+$/.test(token)) return token;
      const lower = token.toLocaleLowerCase("pt-BR");
      if (index > 0 && SMALL.has(lower)) return lower;
      return capitalize(lower);
    })
    .join("");
}

export const courseName = (course: Pick<Course, "name">) =>
  titleCase(course.name);
export const courseShortName = (course: Pick<Course, "short_name">) =>
  titleCase(course.short_name);
