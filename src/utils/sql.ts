// Sanitização de valores para SQL seguro no DuckDB
export const escapeSqlLiteral = (val: string): string => {
  return String(val).replace(/'/g, "''");
};

export const escapeSqlLikePattern = (val: string): string => {
  // Escapa aspas simples e caracteres de controle
  return escapeSqlLiteral(val).replace(/[%_\\]/g, '\\$&');
};
