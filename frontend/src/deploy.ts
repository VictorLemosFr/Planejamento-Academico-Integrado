/**
 * Ligado no build da versão online de testes (VITE_PUBLIC_DEMO=true no
 * Dockerfile). Avisa que o site é compartilhado e não deve receber dados reais.
 */
export const publicDemo = import.meta.env.VITE_PUBLIC_DEMO === "true";

export const publicDemoNotice =
  "Versão de testes da equipe. Use apenas dados fictícios: não envie seu histórico real nem dados pessoais.";
