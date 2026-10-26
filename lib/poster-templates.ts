export const posterTemplates = {
  ranking: "ranking_semanal.jpeg",
  weekly: "papeis_semanais.jpeg",
  fixtures: "cartaz_calendário.jpeg",
  daily: "cartaz diario.jpeg",
  results: "cartaz_resultados.jpeg",
  "title-ouro": "gold_title_fight.jpeg",
  "title-prata": "silver_title_fight.jpeg",
  "title-bronze": "bronze_title_fight.jpeg",
} as const;
export type PosterTemplate = keyof typeof posterTemplates;
export const posterTemplateUrl = (key: PosterTemplate) =>
  `/api/poster-templates/${key}`;
