# Espaços de trabalho

As contas administrativas escolhem Jogador ou Administrador ao iniciar uma nova sessão. O seletor no canto superior direito permite mudar a qualquer momento. Jogadores comuns entram diretamente e não recebem o seletor.

A escolha é guardada na sessão do servidor. O papel da conta não muda: o espaço Jogador utiliza permissões de jogador, incluindo nas chamadas diretas à API. Ideias, propostas privadas, auditoria e contactos administrativos não são enviados nesse espaço. Uma conta administrativa pode jogar normalmente e editar apenas os próprios atributos pessoais.

A alteração de espaço é registada na auditoria e propaga-se às outras abas da mesma sessão através das atualizações em tempo real. Sessões noutros dispositivos podem usar espaços diferentes. Escritas verificam novamente a sessão na transação, impedindo uma ação administrativa pendente de ser aplicada depois de mudar para Jogador. A seleção inicial é obrigatória para escritas; escolher Administrador não é permitido a contas de jogador.

Admin → Ideias contém notas partilhadas entre administradores. Jogador → Cartões contém os atributos autoavaliados e cartões calculados a partir de resultados oficiais; Jogador → Palpites contém previsões gratuitas dos jogos publicados.
