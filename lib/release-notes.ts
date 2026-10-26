/** Every release increments package.json and adds an immutable entry here. */
export const applicationVersion = "1.3.1";
export const releaseNotes = [
  {
    version: "1.3.1",
    date: "2026-10-26",
    title: "Resumo das marcações e consulta dos campos",
    changes: [
      "O Resumo lista os confrontos ainda sem marcação confirmada, com as duas duplas, divisão, semana e horário proposto.",
      "Filtro por divisão e acesso direto para marcar e confirmar cada jogo; os jogos já agendados ficam fora desta lista.",
      "Reservar no Playtomic disponível apenas no espaço de administrador; jogadores consultam horários sem botões de reserva.",
      "Grelha de disponibilidade mais compacta, com cabeçalho Campos e coluna dos nomes mais estreita.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-25",
    title: "Fecho da jornada e preparação da próxima semana",
    changes: [
      "O último resultado validado encaminha o administrador para o ranking semanal da divisão correta e prepara a próxima jornada em privado.",
      "Fluxo guiado: publicar ranking, rever e aprovar papéis, publicar a divisão e ativar a abertura; sem publicação automática.",
      "Publicação e notificações dos papéis por divisão, preservando as restantes e a compatibilidade com o histórico.",
      "Uma única configuração de abertura: aguardar, data e hora ou contagem decrescente.",
      "Filtros administrativos dos desafios por ação necessária, semana, origem, divisão e pesquisa de duplas.",
      "Cartões de jogo mais visíveis e botões de calendário do telemóvel e Google Calendar nos jogos confirmados dos jogadores.",
      "Testes de concorrência com MongoDB replica set para desafios simultâneos e proteção de rascunhos privados.",
    ],
  },
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
