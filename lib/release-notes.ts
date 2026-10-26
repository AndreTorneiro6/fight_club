/** Every release increments package.json and adds an immutable entry here. */
export const applicationVersion = "1.6.0";
export const releaseNotes = [
  {
    version: "1.6.0",
    date: "2026-10-26",
    title: "Central de Apostas — teste privado",
    changes: [
      "Central apenas para administradores, com um voto na dupla vencedora por pessoa e jogo e distribuição dos votos.",
      "Conversa geral por jogo com menções @ a jogadores e administradores; mensagens de teste sem notificações para jogadores.",
      "Votos fecham antes do início; sem previsão de sets, ligação às moedas ou alterações ao ranking. Interface adaptada ao telemóvel.",
    ],
  },
  {
    version: "1.5.7",
    date: "2026-10-26",
    title: "Neiva Coins — gestão de carteiras",
    changes: [
      "Vista administrativa das carteiras com pesquisa, paginação, saldos e acesso direto à gestão de cada jogador.",
      "Moeda com nome editável pelo administrador, resumo de saldos/trocas/recompensas e carteiras adaptadas ao telemóvel.",
      "Teste continua privado para administradores, preservando saldos, regras e nomes já configurados.",
    ],
  },
  {
    version: "1.5.6",
    date: "2026-10-26",
    title: "Navegação e filtros do resumo administrativo",
    changes: [
      "Voltar ao resumo no detalhe do desafio em modo administrador; jogadores continuam a voltar aos desafios.",
      "Jogos por marcar com filtros Todos, Ouro, Prata e Bronze e contagem por divisão, no mesmo formato de Jogadores.",
    ],
  },
  {
    version: "1.5.5",
    date: "2026-10-26",
    title: "Emblema único de Bronze nos cartazes",
    changes: [
      "Capacete de icon_bronze aplicado aos cartazes de ranking, papéis semanais, jornada, diários, resultados e exportações individuais de Bronze.",
      "Title Fights de Bronze usam o mesmo emblema, mantendo o restante desenho do cinturão e dos modelos.",
    ],
  },
  {
    version: "1.5.4",
    date: "2026-10-26",
    title: "Posições das duplas nos cartazes e jogos antigos",
    changes: [
      "Posições individuais antigas deixam de ser apresentadas como posições de dupla nos cartazes.",
      "Normalização auditada dos jogos antigos cuja posição pode ser validada, mantendo os rankings, horários, adversários e papéis.",
      "Title Fights identificam a dupla campeã mesmo quando o desafio foi enviado ao segundo jogador; novos jogos publicados guardam explicitamente o modelo por duplas.",
    ],
  },
  {
    version: "1.5.3",
    date: "2026-10-26",
    title: "Cartaz diário e da jornada com ranking",
    changes: [
      "Novo modelo cartaz_diario_ranking aplicado aos cartazes da jornada, diários e jogos individuais, com quantidade de jogos configurável.",
      "Por defeito inclui todos os jogos do dia selecionado; o administrador pode definir quantos jogos apresentar por imagem.",
      "A imagem cresce em altura conforme o número de jogos, mantendo a escala das linhas e sem cortar confrontos.",
      "Posições das duplas nas caixas laterais do modelo, com os valores guardados no jogo e variantes de Ouro, Prata e Bronze.",
      "Grafismo original preservado, incluindo cabeçalho, molduras e rodapé; Title Fights continuam com os modelos próprios.",
    ],
  },
  {
    version: "1.5.2",
    date: "2026-10-26",
    title: "Resumo de administração mais compacto",
    changes: [
      "Indicadores da liga numa faixa compacta e duas colunas independentes para eliminar espaços vazios entre cartões.",
      "Jogos por marcar em linhas mais curtas, ações e estado da jornada reorganizados; publicações aparecem apenas quando há trabalho por concluir.",
      "Disposição adaptada ao telemóvel, mantendo os nomes das duplas, filtros e acessos às marcações.",
      "Limpeza auditada dos jogos cancelados e respetivas referências, protegendo resultados oficiais e ranking.",
    ],
  },
  {
    version: "1.5.1",
    date: "2026-10-26",
    title: "Correção visual dos cartazes",
    changes: [
      "Restauro localizado dos campos dos modelos originais, sem retângulos opacos sobre o grafismo.",
      "Cabeçalhos, molduras, emblemas e slogan originais preservados nas exportações de jornada e jogos individuais.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-10-26",
    title: "Menções no chat dos desafios",
    changes: [
      "Exportação individual de jogos com o modelo da jornada e a divisão correta; jogos do título usam automaticamente o respetivo modelo especial.",
      "Escreve @ no chat para mencionar um jogador das duplas ou um administrador verificado.",
      "Menções destacadas nas mensagens e notificação pessoal com acesso direto à mensagem.",
      "Validação dos destinatários no servidor e uma única notificação por destinatário e mensagem.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-10-26",
    title: "Cartazes com os modelos do clube e Title Fights separados",
    changes: [
      "Modelos do clube para cartazes da jornada, calendário diário, resultados, ranking e papéis semanais.",
      "Title Fights separados dos jogos normais, com um cartaz próprio por jogo e modelos de Ouro, Prata e Bronze.",
      "Dados reais das duplas, datas, horários e resultados por set substituem os exemplos impressos nos modelos.",
      "Exportar, copiar e partilhar os novos cartazes; modelos disponíveis apenas para administradores autenticados.",
      "Depois da marcação, o calendário do desafio mostra apenas o dia, o campo e as horas confirmadas, sem pesquisa de outras datas.",
    ],
  },
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
