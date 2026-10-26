export const adminGroups = [
  {
    label: "Pessoas",
    items: [
      ["players", "Jogadores"],
      ["registration", "Convites"],
      ["partners", "Parceiros"],
      ["payments", "Pagamentos"],
    ],
  },
  {
    label: "Competição",
    items: [
      ["placement", "Eventos de colocação"],
      ["simulation", "Simulador de desafios"],
      ["matchmaking", "Jornadas e emparelhamento"],
      ["weekly", "Papéis semanais"],
      ["turnover", "Preparar próxima jornada"],
      ["rankings", "Rankings"],
      ["challenges", "Desafios"],
      ["games", "Jogos"],
      ["results", "Resultados"],
      ["posters", "Cartazes da jornada"],
    ],
  },
  {
    label: "Configuração",
    items: [
      ["notes", "Ideias"],
      ["coins", "Moedas e bar"],
      ["voting", "Central de Apostas"],
      ["gamification", "Gamificação"],
      ["sponsors", "Patrocínios"],
      ["engagement", "Cartões e palpites"],
      ["album", "Caderneta"],
      ["photos", "Fotografias para desbloquear"],
      ["rules", "Regras"],
      ["courts", "Campos"],
      ["audit", "Auditoria"],
      ["changelog", "Versões e alterações"],
    ],
  },
] as const;

export const adminTabs: ReadonlySet<string> = new Set([
  "summary",
  "approvals",
  ...adminGroups.flatMap((group) => group.items.map(([id]) => id)),
]);
