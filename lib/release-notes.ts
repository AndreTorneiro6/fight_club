/** Every release increments package.json and adds an immutable entry here. */
export const applicationVersion = "1.2.0";
export const releaseNotes = [
  {
    version: "1.2.0",
    date: "2026-10-25",
    title: "Imagens para partilhar no WhatsApp",
    changes: [
      "Cartão individual de cada jogo confirmado com as duas duplas, horário, campo e resultado validado.",
      "Botão Copiar imagem nos cartões de jogo, rankings, papéis semanais e cartazes da jornada.",
      "Download em PNG e partilha pelo dispositivo, com alternativa quando o navegador não permite copiar imagens.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-25",
    title: "Gestão da jornada e transparência dos confrontos",
    changes: [
      "Painel do admin com decisões prioritárias e ferramentas secundárias pesquisáveis.",
      "Papéis futuros atualizados com as regras de cada divisão e os papéis efetivos anteriores, mantendo a aprovação e publicação pelo admin.",
      "Histórico dos papéis com o papel inicial publicado e o papel final de cada dupla.",
      "Origem dos desafios visível para o admin: jogador, regras automáticas ou criação administrativa.",
      "Title Fight centrado nos jogos confirmados pelo título e nos seus resultados, sem escolha manual do campeão nesta página.",
      "Página de versões e alterações na administração.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-25",
    title: "Base da aplicação antes do versionamento visível",
    changes: [
      "Gestão de duplas, rankings, desafios obrigatórios, horários e resultados por set.",
      "Abertura de desafios por divisão, contagem decrescente e regras dinâmicas da Bronze.",
      "Espaços separados para administrador e jogador; notificações na aplicação, email e push.",
      "Correção do acesso à Internet do serviço de notificações e do alcance apresentado no ranking.",
    ],
  },
] as const;
