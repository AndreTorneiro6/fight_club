export const posterTemplates = {
  "bronze-emblem": "icon_bronze.jpeg",
  "title-bronze-emblem-clean": "title-bronze-emblem-clean.png",
  "fixtures-ranked": "cartaz_diario_ranking.jpeg",
  "fixtures-ranked-clean": "fixtures-ranked-clean.png",
  "fixtures-ranked-prata": "fixtures-ranked-prata.png",
  "fixtures-ranked-bronze": "fixtures-ranked-bronze.png",
  "fixtures-ouro": "fixtures-ouro.png",
  "results-prata": "results-prata.png",
  "fixtures-clean": "fixtures-clean.png",
  "results-clean": "results-clean.png",
  "title-ouro-clean": "title-ouro-clean.png",
  "title-prata-clean": "title-prata-clean.png",
  "title-bronze-clean": "title-bronze-clean.png",
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
