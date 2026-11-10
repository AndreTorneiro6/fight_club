/** Every release increments package.json and adds an immutable entry here. */
export const applicationVersion = "1.19.4";
export const releaseNotes = [
  {
    version: "1.19.4",
    date: "2026-11-10",
    title: "Escrever nos prémios sem perder o foco",
    changes: [
      "Ao editar prémios e outros formulários em janela, escrever já não desvia o foco para o botão Fechar. Mantêm-se o fecho por Escape, a navegação por Tab e o regresso ao botão que abriu a janela.",
    ],
  },
  {
    version: "1.19.3",
    date: "2026-11-08",
    title: "Jogos adiados e tarefas da próxima semana no Resumo",
    changes: [
      "Em Ouro, Prata e Bronze, um jogo adiado de outra jornada não impede criar ou receber o desafio da nova semana, mesmo quando a recuperação já está marcada nessa semana.",
      "A recuperação e o jogo regular podem ser agendados na mesma semana, em horários compatíveis. Mantêm-se um desafio por jornada, os limites de jogos ativos e a proteção contra sobreposição de jogadores e campos.",
      "O Resumo inclui as tarefas da semana atual e da próxima por divisão: preparar, aprovar ou publicar papéis, abrir desafios, publicar jogos obrigatórios em rascunho e agendar jogos, com acesso direto ao contexto certo.",
    ],
  },
  {
    version: "1.19.2",
    date: "2026-11-06",
    title: "Ranking automático com gestão semanal pelo administrador",
    changes: [
      "Quando uma divisão termina os jogos, apenas o ranking é publicado automaticamente. Os papéis ficam em rascunho para revisão, aprovação e publicação pelo administrador, que decide a abertura dos desafios.",
      "O resumo da jornada e as regras explicam a responsabilidade do administrador pelas próximas etapas.",
    ],
  },
  {
    version: "1.19.1",
    date: "2026-11-05",
    title: "Tipo de semana e histórico dos papéis mais claros",
    changes: [
      "Gerir semana explica que Normal ou Ataque livre se aplica a todas as divisões e permite abrir diretamente a configuração global da semana escolhida, com regresso à divisão anterior.",
      "Semanas passadas ou com papéis publicados mostram o motivo do bloqueio em vez de um seletor desativado sem explicação.",
      "O histórico dos papéis identifica as semanas pelo número na época, destaca a semana mais recente e diferencia Ataque e Defesa com cores no papel final. A data continua disponível ao passar sobre a semana.",
    ],
  },
  {
    version: "1.19.0",
    date: "2026-11-05",
    title: "Gestão semanal num só espaço",
    changes: [
      "Gerir semana reúne papéis, jogos obrigatórios, agendamento, resultados e correções, com uma única seleção de semana e divisão.",
      "O resumo e a navegação dão acesso direto à gestão semanal. As tarefas mostram os papéis publicados, os pares em rascunho e os jogos por agendar ou resolver.",
      "Ao abrir um jogo a partir da gestão semanal, podes voltar à mesma semana, divisão e tarefa. Os rascunhos, publicações e intervenções mantêm as validações e o histórico existentes.",
    ],
  },
  {
    version: "1.18.0",
    date: "2026-11-04",
    title: "Preparar confrontos de qualquer semana da época",
    changes: [
      "O planeamento manual permite selecionar qualquer semana atual ou futura da época, com a próxima semana selecionada por defeito. O modo de confrontos aplica-se só à divisão e semana escolhidas.",
      "Os pares ficam guardados em rascunhos privados até publicar. Podes preparar várias semanas sem criar desafios ativos ou avisar os jogadores. Ao publicar, o sistema revalida todos os pares e cria os jogos em conjunto; se uma validação falhar, o rascunho mantém-se.",
      "Jogos publicados de semanas futuras não consomem vagas ativas de semanas anteriores. As férias e os prazos são calculados pela semana escolhida.",
    ],
  },
  {
    version: "1.17.0",
    date: "2026-11-04",
    title: "Confrontos definidos pela administração por divisão",
    changes: [
      "Em Administração → Desafios, cada divisão pode ficar em modo Administração define os jogos. O clube escolhe as duplas e os jogadores combinam apenas o horário; o algoritmo não cria confrontos adicionais. As regras de ranking, título, repetição e limites mantêm-se.",
      "As divisões continuam no modo atual até o administrador alterar a opção. Mudar de modo preserva os jogos existentes e fica registado na auditoria.",
      "O planeador deixa de sugerir um adversário com quem já existe um jogo pendente de uma semana anterior, mesmo que esse jogo esteja congelado.",
    ],
  },
  {
    version: "1.16.4",
    date: "2026-11-04",
    title: "Apostas por semana",
    changes: [
      "A Central de Apostas abre nos jogos desta semana. Os filtros Anteriores e Próximas separam os jogos antigos e futuros, mantendo os estados de apostas, a divisão, os palpites e os marcadores em direto. Os jogos adiados aparecem na semana da data marcada.",
    ],
  },
  {
    version: "1.16.3",
    date: "2026-11-04",
    title: "Resultado disponível desde o início do jogo",
    changes: [
      "O registo oficial de resultado fica disponível a partir da hora de início, sem esperar pelo fim da reserva. O marcador provisório continua disponível durante o jogo e atualiza as Apostas; só a confirmação oficial liquida as apostas e altera o ranking.",
    ],
  },
  {
    version: "1.16.2",
    date: "2026-11-04",
    title: "Resultado com sets e vencedor sem resultado",
    changes: [
      "A intervenção administrativa oferece as duas opções em separado: registar o resultado com sets ou definir apenas o vencedor com motivo obrigatório. Mantém o adiamento para uma data escolhida.",
    ],
  },
  {
    version: "1.16.1",
    date: "2026-11-04",
    title: "Adiamento de jogos e vencedor sem sets",
    changes: [
      "A ação Declarar vencedor na intervenção administrativa deixa de exigir sets: basta escolher o vencedor e indicar um motivo, mesmo sem marcação do jogo.",
      "Em Editar jogo, o administrador pode adiar por lesão ou outro impedimento para uma data escolhida, mantendo a jornada original, prolongando o prazo e registando o motivo. O jogo fica congelado até à nova data.",
    ],
  },
  {
    version: "1.16.0",
    date: "2026-11-03",
    title: "Vencedor sem resultado com frase de validação",
    changes: [
      "O administrador pode definir o vencedor de um jogo sem introduzir os sets, bastando escrever uma frase de validação (igual à exclusão de jogos).",
      "Remove o modo manual de papéis semanais por jogo (versão 1.15.0): a atribuição de Ataque/Defesa volta a ser apenas pela publicação dinâmica ou aprovada pelo admin.",
      "Simplifica a intervenção administrativa: sem seletor de papéis personalizados por jogo, mantendo apenas o registo de resultado oficial ou vencedor sem resultado.",
    ],
  },
  {
    version: "1.15.0",
    date: "2026-11-03",
    title: "Modo manual de papéis semanais por jogo",
    changes: [
      "Os papéis semanais podem ser colocados em modo manual mesmo depois de publicados: o administrador ativa o modo manual por divisão/semana e passa a poder alterar Ataque/Defesa por jogo individual.",
      "Em Intervenção administrativa no detalhe do desafio, aparece um seletor de papéis personalizados quando o modo manual está ativo. Permite trocar quem ataca e quem defende sem cancelar o jogo.",
      "Jogos desmarcados voltam ao estado 'por marcar' no resumo (A marcar / A confirmar horário), evitando esquecimentos. Cancelar e voltar a marcar jogos individuais continua a funcionar sem ter de relançar a jornada inteira.",
      "Inclui botão 'Modo manual (alterar papéis por jogo)' em Papéis semanais por divisão, com registo de auditoria e notificações aos jogadores afetados.",
    ],
  },
  {
    version: "1.14.1",
    date: "2026-11-02",
    title: "Jogos congelados não ocupam vagas na jornada",
    changes: [
      "Um jogo que não pode ser disputado em nenhum dia da semana (adiado para depois da semana ou com um jogador de férias a semana toda) deixa de contar para o limite de desafios ativos dessa semana. A dupla continua a poder ter um jogo na jornada, que fica congelado até ao regresso.",
    ],
  },
  {
    version: "1.14.0",
    date: "2026-11-02",
    title: "Duplas de férias podem ser desafiadas",
    changes: [
      "Uma dupla com um jogador de férias continua na jornada: pode ser desafiada e o jogo fica congelado até ao regresso, como já indicava o ecrã de Papéis semanais.",
      "Uma dupla que já tem o máximo de desafios ativos de semanas anteriores fica fora da jornada, com o motivo explicado.",
      "A mensagem de recusa passa a indicar o motivo real quando a dupla adversária não está disponível.",
    ],
  },
  {
    version: "1.13.1",
    date: "2026-11-02",
    title: "Disponibilidade das equipas visível para a administração",
    changes: [
      "Depois de o jogo estar marcado e aprovado, a administração volta a ver no calendário do jogo a disponibilidade e as sugestões de horário de cada equipa, os horários em comum e quem propôs e confirmou o horário escolhido. Os jogadores continuam a ver apenas o horário confirmado.",
    ],
  },
  {
    version: "1.13.0",
    date: "2026-11-02",
    title: "Papéis semanais com histórico e jogos possíveis",
    changes: [
      "Em Papéis semanais, cada dupla mostra o papel publicado e o papel final da jornada anterior (o lado em que realmente jogou), com o adversário e o resultado.",
      "O histórico das últimas cinco jornadas fica disponível em cada dupla.",
      "Ao atribuir papéis, cada dupla mostra quem pode atacar ou por quem pode ser atacada, o jogo previsto no plano e um aviso quando fica sem jogo possível ou quando o planeador mudaria o seu papel.",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-11-02",
    title: "Fecho automático da jornada por divisão",
    changes: [
      "Quando todos os jogos de uma divisão têm resultado, o ranking é publicado automaticamente, seguido dos papéis da próxima jornada e da abertura dos desafios. Os jogos congelados por férias não bloqueiam a divisão.",
      "Os papéis gerados respeitam a regra de não repetir o adversário da semana anterior e as férias, e garantem o máximo de jogos sem trocas de papel depois da publicação.",
      "Uma divisão com jogos em falta espera sozinha; a organização recebe um aviso à hora do ranking semanal. O fecho automático pode ser desligado em Regras.",
      "A reatribuição de um desafio pela organização respeita as mesmas regras e mantém o jogo obrigatório atribuído.",
    ],
  },
  {
    version: "1.11.27",
    date: "2026-11-02",
    title: "Nenhuma dupla fica sem adversário possível",
    changes: [
      "Todos os desafios da jornada, incluindo o primeiro, só são aceites se mantiverem o máximo de jogos possível. Um desafio que deixaria outra dupla sem adversário é recusado com explicação.",
    ],
  },
  {
    version: "1.11.26",
    date: "2026-11-01",
    title: "Papéis da Prata respeitados e correção depois da abertura",
    changes: [
      "Uma divisão publicada sozinha (como a Prata) passa a usar os papéis publicados; antes a app podia trocar papéis sem motivo.",
      "Corrigir papéis funciona também depois da abertura, desde que ainda não haja desafios nessa divisão nessa semana.",
    ],
  },
  {
    version: "1.11.25",
    date: "2026-11-01",
    title: "Corrigir papéis publicados no ecrã",
    changes: [
      "Em Papéis semanais, com uma divisão selecionada, os desafios fechados e sem compromissos nessa semana, o administrador pode voltar a escolher Ataque/Defesa e usar Corrigir papéis. Fica no histórico e só avisa quem muda de papel.",
    ],
  },
  {
    version: "1.11.24",
    date: "2026-11-01",
    title: "Caderneta reservada aos administradores",
    changes: [
      "Com a comunidade da caderneta desligada, os espaços Jogador e Espetador deixam de mostrar a caderneta e também os avisos de trocas e denúncias de cromos.",
    ],
  },
  {
    version: "1.11.23",
    date: "2026-11-01",
    title: "Sem confrontos repetidos em semanas seguidas",
    changes: [
      "Em todas as divisões, duas duplas que jogaram entre si numa semana não podem voltar a defrontar-se na semana seguinte. Esses adversários deixam de aparecer e os papéis dinâmicos já os excluem.",
      "Quando um desafio semanal é cancelado, os papéis são recalculados e só as duplas cujo papel muda recebem o aviso. Em caso de empate, a dupla que já lançou desafio nessa semana mantém o ataque.",
    ],
  },
  {
    version: "1.11.22",
    date: "2026-10-31",
    title: "Correção de papéis publicados antes da abertura",
    changes: [
      "O administrador pode corrigir os papéis já publicados de uma divisão enquanto os desafios ainda não abriram e não existem desafios nessa semana.",
      "Só os jogadores cujo papel muda recebem o aviso Papel semanal corrigido; a correção fica registada no histórico.",
    ],
  },
  {
    version: "1.11.21",
    date: "2026-10-31",
    title: "Publicar papéis por divisão num só passo",
    changes: [
      "Cada divisão tem o botão Publicar papéis, que guarda, aprova e publica os papéis dessa divisão de uma vez, sem depender das outras.",
      "Antes de publicar, a app avisa quando os papéis dinâmicos vão alterar o papel de alguma dupla, para evitar avisos contraditórios aos jogadores.",
      "Uma alteração dinâmica numa divisão já publicada deixou de bloquear a publicação das restantes. A regra do título indica agora claramente a última posição que pode desafiar o campeão.",
    ],
  },
  {
    version: "1.11.20",
    date: "2026-10-31",
    title: "Ranking semanal publicado por divisão",
    changes: [
      "O ranking semanal é publicado automaticamente para cada divisão no dia e hora definidos em Regras; uma divisão com a jornada por fechar já não impede a publicação das restantes.",
      "Os administradores podem publicar de imediato o ranking da divisão escolhida e notificar os seus jogadores. O painel mostra o dia configurado e a última publicação dessa divisão.",
    ],
  },
  {
    version: "1.11.19",
    date: "2026-10-30",
    title: "Avisos do marcador em direto para apostadores",
    changes: [
      "Quando o administrador altera o marcador em direto, quem mantém um palpite nesse jogo recebe um aviso na aplicação e por push, com a pontuação provisória e ligação ao jogo.",
      "Guardar o mesmo marcador não repete avisos. As notificações do resultado oficial e das suas correções mantêm-se; o marcador em direto não apura palpites nem altera o ranking.",
    ],
  },
  {
    version: "1.11.18",
    date: "2026-10-29",
    title: "Publicações incrementais e validação do alcance de três posições",
    changes: [
      "As publicações reutilizam caches de dependências e compilação, reduzindo trabalho repetido e mantendo verificações de saúde e recuperação da versão anterior.",
      "Validação adicional do emparelhamento em Ouro e Prata com alcance de três posições, preservando os jogos atribuídos e as regras do título.",
    ],
  },
  {
    version: "1.11.17",
    date: "2026-10-29",
    title: "Caderneta e trocas em prévia administrativa",
    changes: [
      "Prévia para administradores com inventário por época, repetidos disponíveis e reservados, comunidade opcional e negociações de vários cromos.",
      "Chat privado, contrapropostas, aceitação da versão atual, comprovativos, bloqueios e denúncias com acesso de suporte registado. Os avisos usam a aplicação e push.",
      "Cada cromo obtido pode ser virado para consultar o verso com cartoon, slogan, assinatura e avaliação fora de campo guardados na prévia administrativa.",
      "O acesso de jogadores e espetadores à caderneta permanece desligado nesta publicação.",
    ],
  },
  {
    version: "1.11.16",
    date: "2026-10-29",
    title: "Cromos com os modelos originais",
    changes: [
      "Cartão pessoal, frente da carta dos administradores e cromos da caderneta seguem os modelos Ouro, Prata e Bronze fornecidos, com fotografia, rating e seis atributos reais.",
      "A exportação pessoal usa o mesmo desenho da prévia; os cromos da caderneta podem ser ampliados no telemóvel. A caderneta mantém-se privada para os administradores.",
    ],
  },
  {
    version: "1.11.15",
    date: "2026-10-29",
    title: "Congelado com o formato largo dos outros jogos",
    changes: [
      "O cartão congelado usa a largura e as proporções horizontais dos jogos normais, sem aumentar a altura; Ouro, Prata e Bronze mantêm o tamanho original.",
    ],
  },
  {
    version: "1.11.14",
    date: "2026-10-29",
    title: "Tamanho original do Title Fight reposto",
    changes: [
      "Ouro, Prata e Bronze recuperam os cartões largos e a disposição original; o congelado aumenta para a mesma largura disponível.",
    ],
  },
  {
    version: "1.11.13",
    date: "2026-10-29",
    title: "Cartões Title Fight com dimensões iguais",
    changes: [
      "Jogos normais e congelados usam a mesma largura e altura no telemóvel e computador, com a arte original adaptada sem deformar os emblemas ou jogadores.",
    ],
  },
  {
    version: "1.11.12",
    date: "2026-10-29",
    title: "Title Fight com a arte original",
    changes: [
      "Cartões das três divisões e jogos congelados preservam os fundos, emblemas, molduras e efeitos das imagens fornecidas.",
      "Cartazes exportados mantêm também o desenho original, com nomes, datas, estados e resultados atualizados.",
    ],
  },
  {
    version: "1.11.11",
    date: "2026-10-29",
    title: "Jogos congelados visíveis no Title Fight",
    changes: [
      "Os confrontos pelo título congelados por férias aparecem numa secção aberta para administradores, jogadores e espetadores, mesmo antes de terem horário.",
      "Cada jogo aparece uma única vez e mantém o visual de gelo e a data de regresso.",
    ],
  },
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
