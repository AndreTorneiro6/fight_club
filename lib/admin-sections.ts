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
      ["matchmaking", "Jornadas e emparelhamento"],
      ["weekly", "Papéis semanais"],
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
      ["gamification", "Gamificação"],
      ["sponsors", "Patrocínios"],
      ["assistant", "Assistente"],
      ["engagement", "Cartões e palpites"],
      ["album", "Caderneta"],
      ["rules", "Regras"],
      ["courts", "Campos"],
      ["audit", "Auditoria"],
    ],
  },
] as const;

export const adminTabs: ReadonlySet<string> = new Set([
  "summary",
  "approvals",
  ...adminGroups.flatMap((group) => group.items.map(([id]) => id)),
]);
