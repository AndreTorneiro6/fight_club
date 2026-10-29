/** Every release increments package.json and adds an immutable entry here. */
export const applicationVersion = "1.11.10";
export const releaseNotes = [
  {
    version: "1.11.10",
    date: "2026-10-29",
    title: "Jogos congelados com visual de gelo",
    changes: [
      "Title Fight e desafios normais adiados por férias usam a moldura de gelo, raquete congelada e indicação Jogo congelado.",
      "Os cartões mostram a data de regresso e retomam o visual normal quando termina o congelamento, mantendo as regras e as ações existentes.",
    ],
  },
  {
    version: "1.11.9",
    date: "2026-10-29",
    title: "Proteção de contas, fotografias e resultados",
    changes: [
      "Recuperar a conta invalida todos os links anteriores; tentativas de entrada não bloqueiam o email de outro jogador.",
      "Inscrições pendentes deixam de ocupar a capacidade da divisão; aprovação mantém o limite e o registo protege a existência de contas.",
      "Fotografias não publicadas protegidas, chat apenas por push e exportações com proteção contra fórmulas.",
      "Férias posteriores ao jogo não impedem o resultado; desafios expirados deixam de bloquear o fecho da jornada.",
    ],
  },
  {
    version: "1.11.8",
    date: "2026-10-28",
    title: "Controlos de Jogos e ecrãs mais compactos",
    changes: [
      "Jogos com botões Meus jogos, Minha liga e Jogos da liga, seguidos de Ouro, Prata e Bronze, sem select.",
      "Espaço da dupla, marcadores e jogos de hoje com menos volume e melhor separação; música e conversa lado a lado em ecrãs grandes.",
      "Title Fight com títulos mais equilibrados e mais espaço entre cartões; controlos adaptados ao telemóvel.",
    ],
  },
  {
    version: "1.11.7",
    date: "2026-10-28",
    title: "Espaço da dupla e notificações mais rápidas",
    changes: [
      "Música de entrada da dupla no perfil: os dois jogadores podem editar o link do YouTube; admins podem abri-lo no jogo e no Title Fight.",
      "Chat privado da dupla no perfil, visível exclusivamente aos dois membros, com atualização automática.",
      "Fila push processada a cada cinco segundos com envios em paralelo; a página evita carregar auditoria quando não é necessária, preservando todo o histórico.",
    ],
  },
  {
    version: "1.11.6",
    date: "2026-10-28",
    title: "Filtrar Jogos pela tua liga",
    changes: [
      "Atalho Minha liga e filtro Ouro/Prata/Bronze na agenda, disponíveis também no telemóvel.",
      "Meus jogos continua a mostrar só a tua dupla; Jogos da liga permite voltar a todos os confrontos.",
      "Chat privado mantém-se dentro do jogo para participantes e admins; chat público apenas nas Apostas.",
      "Palpites dos jogos removido do menu de jogador; o acesso antigo abre a Central de Apostas e o selo Novo expira três dias após o lançamento.",
    ],
  },
  {
    version: "1.11.5",
    date: "2026-10-28",
    title: "Jogos de hoje num cartão próprio",
    changes: [
      "Jogos de hoje apresentados num cartão independente logo abaixo de Competição — Esta jornada, fora das prioridades.",
      "O cartão acompanha o dia atual em Portugal; resultados oficiais em falta continuam nas ações pendentes, mesmo em dias seguintes.",
    ],
  },
  {
    version: "1.11.4",
    date: "2026-10-28",
    title: "Title Fight segue o novo modelo",
    changes: [
      "Emblema e nome da liga no topo esquerdo, com ataque e defesa alinhados à direita e confronto em destaque.",
      "Ouro, prata e bronze com molduras, cores e atmosfera próprias; data no canto inferior direito e histórico compacto.",
      "Nomes, horários, resultados e marcadores provisórios permanecem dinâmicos, com adaptação a telemóvel.",
    ],
  },
  {
    version: "1.11.3",
    date: "2026-10-28",
    title: "Marcador provisório e jogos de hoje",
    changes: [
      "Todos os jogos iniciados mostram 0–0 automaticamente; o admin pode atualizar opcionalmente só os sets ou os jogos de cada set.",
      "Marcador visível nos jogos, Title Fight e Central de Apostas. A confirmação oficial continua a determinar ranking, apostas e notificações.",
      "Jogos de hoje aparecem em O que precisas de fazer no Resumo, com horário e estado; os resultados em falta continuam assinalados após o fim previsto.",
    ],
  },
  {
    version: "1.11.2",
    date: "2026-10-28",
    title: "Resumo acompanha jogos desde o início",
    changes: [
      "Jogos em curso entram nas pendências do Resumo assim que começa o horário marcado, com acesso à agenda e ao jogo.",
      "No fim do horário previsto, a pendência passa automaticamente para Resultados por registar; desaparece após confirmação dos sets oficiais.",
      "Resumo atualiza nas mudanças de horário e ao regressar à aplicação, sem exigir recarregar a página.",
    ],
  },
  {
    version: "1.11.1",
    date: "2026-10-28",
    title: "Jogos pela proximidade do horário",
    changes: [
      "Disponibilidade dos campos retirada da agenda de jogador; a organização mantém o calendário na administração.",
      "Listas de jogos apresentam primeiro os encontros a decorrer e os próximos, do mais próximo para o mais distante; jogos sem horário ficam no fim.",
      "Histórico do mais recente para o mais antigo, com a mesma ordenação em Jogos, Desafios, Title Fight, apostas e administração.",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-10-28",
    title: "Title Fight com o visual da arena",
    changes: [
      "Novo layout dos jogos pelo título inspirado no modelo fornecido: arena escura, molduras metálicas, duplas de ataque e defesa e destaque ao confronto.",
      "Cartões mostram os nomes reais, divisão, horário e estado do jogo; histórico recolhível com resultados por sets e dupla vencedora.",
      "Filtros de divisão, calendários e acesso administrativo aos cartazes mantidos; apresentação adaptada ao telemóvel e ao modo espetador.",
    ],
  },
  {
    version: "1.10.1",
    date: "2026-10-28",
    title: "Épocas sem divisão fictícia para espetadores",
    changes: [
      "Espetadores ficam excluídos dos totais de jogadores e divisões da época; deixam de criar uma linha Divisão arquivada.",
      "Rankings e divisões históricas guardados nas épocas anteriores mantêm-se disponíveis.",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-10-28",
    title: "Modo espetador",
    changes: [
      "Administradores podem atribuir o acesso Espetador em Jogadores, mantendo as opções de estado existentes.",
      "Espetadores acompanham ranking, jogos, apostas, perfil, Title Fight, Hall of Champions, épocas e estatísticas, e podem fazer palpites.",
      "Sem divisão ou ações de competição, jornadas oficiais, prémios, regras, patrocínios, cromo, caderneta ou trocas.",
      "Administradores podem validar o espaço de espetador sem alterar o seu perfil de jogador ou ranking.",
    ],
  },
  {
    version: "1.9.1",
    date: "2026-10-27",
    title: "Resultados pendentes e emails apenas de conta",
    changes: [
      "Jogos terminados sem resultado confirmado aparecem em O que precisas de fazer, mesmo enquanto o estado continua Marcado.",
      "O atalho Resultados por registar abre os jogos prontos para introduzir os sets; a pendência desaparece após a confirmação.",
      "Email reservado a convites, verificação de endereço e recuperação de palavra-passe; notificações da liga mantêm-se na aplicação e por push.",
      "Avisos de apuramento só após submissão de sets oficiais; fechar apostas ou reiniciar a aplicação não envia avisos retroativos.",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-10-27",
    title: "Resultados oficiais e apuramento dos palpites",
    changes: [
      "Registo administrativo com resultado por sets também na intervenção do desafio, com identificação das duplas de ataque e defesa.",
      "Correções de vencedor reconciliam trocas de ranking quando o histórico permite fazê-lo em segurança; movimentos posteriores ficam preservados para revisão.",
      "Central de Apostas distingue Abertas, A aguardar e Resultados, mostra o resultado oficial e resume a manutenção ou subida de posição.",
      "Cada apostador vê o acerto do seu palpite e recebe um aviso quando o resultado é publicado ou corrigido, respeitando os seus canais de notificação.",
    ],
  },
  {
    version: "1.8.1",
    date: "2026-10-27",
    title: "Editar e apagar mensagens",
    changes: [
      "Podes editar e apagar as tuas mensagens nas conversas de Apostas e dos desafios.",
      "Mensagens alteradas mostram editada; apagar pede confirmação. As mensagens de outras pessoas mantêm-se protegidas.",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-10-27",
    title: "Central de Apostas para todos os jogadores",
    changes: [
      "Jogadores aprovados podem prever os sets e conversar em cada jogo, com Abertas, Os meus palpites e Encerradas e destaque no telemóvel.",
      "Um palpite por conta e jogo, partilhado entre os espaços de jogador e administrador. Só os administradores configuram o fecho.",
      "Jogadores do encontro recebem avisos de novos palpites, sem identificar os autores. Conversas notificam os jogadores do encontro, quem já participou e pessoas mencionadas, sem duplicados nem aviso ao próprio autor.",
      "Anúncio de lançamento agendado; tocar na notificação abre diretamente a Central de Apostas, sem ligação adicional.",
    ],
  },
  {
    version: "1.7.3",
    date: "2026-10-27",
    title: "Apostas abertas e os teus palpites",
    changes: [
      "Central de Apostas organizada em Abertas, Os meus palpites e Encerradas, com contagens por divisão.",
      "Os teus palpites continuam disponíveis depois do fecho. Eliminar um palpite retira-o da tua lista; a conversa de cada jogo mantém-se acessível.",
    ],
  },
  {
    version: "1.7.2",
    date: "2026-10-27",
    title: "Recuperação do envio de mensagens",
    changes: [
      "Conversa dos jogos permite corrigir e reenviar uma mensagem após falha sem reutilizar o identificador do texto anterior.",
      "Falhas de envio mantêm o texto e mostram um aviso junto à mensagem. Repetir o mesmo envio continua a evitar duplicados.",
    ],
  },
  {
    version: "1.7.1",
    date: "2026-10-27",
    title: "Palpites anónimos e sem edição",
    changes: [
      "Resultados previstos visíveis de forma agregada, sem identificar os autores. Cada pessoa vê o seu próprio palpite.",
      "Depois de guardar, o palpite só pode ser eliminado antes do fecho; edição bloqueada também no servidor.",
      "Após eliminar, é possível submeter novo palpite enquanto a votação estiver aberta. Central mantém-se privada para administradores.",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-10-26",
    title: "Palpites por resultado de cada set",
    changes: [
      "Central privada permite prever os resultados de cada set, com terceiro set apenas quando os dois primeiros ficam empatados em sets.",
      "Vencedora do palpite calculada pelos sets, sem alterar resultados, rankings ou estatísticas oficiais.",
      "Palpite guardado pode ser editado ou retirado antes do fecho. Votos antigos sem sets mantidos sem inventar resultados.",
    ],
  },
  {
    version: "1.6.3",
    date: "2026-10-26",
    title: "Administração compacta e largura estável",
    changes: [
      "Menu Mais ferramentas fechado por defeito e após escolher uma secção, com lista limitada em altura.",
      "Cabeçalho e atalhos administrativos mais compactos no telemóvel e tablet.",
      "Ajuste dos controlos do topo em ecrãs intermédios para evitar alargar a página.",
    ],
  },
  {
    version: "1.6.2",
    date: "2026-10-26",
    title: "Moeda no perfil, votação e fotografias desbloqueáveis",
    changes: [
      "Moeda visível junto ao nome e avatar do administrador, com símbolo, nome configurado e saldo da carteira.",
      "Acesso direto a Moedas e bar; apresentação compacta no telemóvel e sem acesso no modo jogador.",
      "Tocar novamente na dupla selecionada retira o voto enquanto a votação está aberta, com atualização das contagens e proteção contra alterações noutra sessão.",
      "Administrador escolhe fechar os votos 30 minutos ou 1 hora antes do jogo; relógio em contagem decrescente em cada jogo.",
      "Catálogo privado de fotografias para administradores, com upload, edição, pré-visualização por jogador e regras de desbloqueio por definir, manuais, jogos ou moedas.",
    ],
  },
  {
    version: "1.6.1",
    date: "2026-10-26",
    title: "Posições e lugar em disputa na votação",
    changes: [
      "Central de Apostas mostra a posição guardada de cada dupla, o papel de ataque/defesa e o lugar em disputa.",
      "Jogos do título identificados e explicação da troca direta de posições, sem alterar o ranking.",
    ],
  },
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
