# Papéis semanais e início da época

## Geração automática

Em **Regras da competição**, a organização pode ativar/desativar a geração automática de rascunhos e escolher a antecedência (0–28 dias; por defeito 7). O worker existente verifica a configuração a cada minuto, numa transação. Apenas épocas ativas geram propostas automaticamente; administradores podem preparar propostas manualmente com a época pausada.

Na competição por jornadas, cria primeiro as jornadas com as datas corretas em **Admin → Competição e jornadas**. Cada liga tem os seus papéis e histórico. A automação prepara os papéis das jornadas configuradas dentro da antecedência, sem inventar datas ou ativar a época. No modo semanal anterior, prepara as semanas dentro da antecedência enquanto não existir uma competição gerida ativa.

A primeira jornada usa **ATAQUE LIVRE** por defeito: todas as duplas elegíveis podem iniciar desafios, exceto o campeão, que só defende. A última dupla só ataca. Os limites de distância, elegibilidade para o título, ausências e compromissos continuam a aplicar-se. O administrador pode configurar semanas especiais. No modo semanal anterior, a primeira proposta da época é de Ataque Livre e o tipo de semana é editável antes de publicar.

Nas semanas normais, o otimizador procura uma distribuição viável de ATAQUE/DEFESA, com preferência suave por alternar relativamente aos papéis anteriormente publicados. A competição gerida também usa o histórico real de adversários e jogos concluídos. Os pares internos usados para calcular papéis não são confrontos oficiais. Uma proposta não inventa resultados nem aumenta estatísticas de ataque/defesa.

## Aprovação e publicação

1. **Gerar proposta de papéis** / **Gerar papéis automaticamente** cria apenas um rascunho privado.
2. O administrador revê os papéis, avisos e adversários elegíveis e pode editar.
3. **Aprovar papéis** guarda a seleção revista e aprova essa versão.
4. **Publicar ATAQUE / DEFESA** / **Publicar papéis da semana** é uma ação separada. Só então os jogadores veem os papéis e recebem o aviso.

O servidor verifica as permissões, a versão, as equipas, o campeão e a última posição. Editar ou regenerar invalida a aprovação. Alterações relevantes na composição/ranking/configuração impedem a publicação de uma aprovação desatualizada. Edições concorrentes não podem sobrescrever silenciosamente outro administrador. Uma versão publicada fica preservada; a automação nunca a substitui nem publica propostas.

O painel mostra **RASCUNHO**, **APROVADO — aguarda publicação** ou **PUBLICADO**. **Histórico de papéis das jornadas anteriores** e **Histórico dos papéis semanais** mostram as atribuições e o estado de cada semana. Os papéis publicados guardam a composição da equipa da altura; os registos antigos sem snapshot continuam legíveis. A aprovação/publicação dos confrontos oficiais continua independente da aprovação/publicação dos papéis.

## Aviso de início da época

Em **Épocas**, **Iniciar época e notificar jogadores** ativa a época e guarda uma notificação para cada jogador ativo e aprovado, incluindo administradores que também joguem. O aviso é enviado por push aos dispositivos com subscrição e permissão. Quem não tiver push encontra o aviso na app. Não é um envio WhatsApp nem uma campanha de email.

O aviso abre **Épocas** e não afirma que os desafios já estão abertos: os papéis precisam de publicação separada. É enviado uma única vez por época. Clicar novamente ou pausar/retomar não cria novos avisos de início. As entregas usam a fila transacional existente, com deduplicação e tentativas de reenvio. Publicar esta implementação não ativa nenhuma época nem envia o aviso.

## Aspeto das notificações

As notificações distinguem início da época, novos desafios, aceitação, marcações, resultados, papéis, lembretes e outras atualizações. A app mostra um ícone e descrição próprios para o evento; o push inclui título, mensagem, ícone e badge correspondentes, com ligação para a página relevante. As mensagens de desafios incluem o confronto quando existe. O sistema operativo pode determinar a apresentação final das notificações do telemóvel.

Os ícones são desenhos gerados por código, sem fotografias de jogadores ou recursos externos. Para regenerar os PNGs: `python3 scripts/notification-icons.py` (usa Pillow, já usado no processamento local de fotografias). O service worker mantém apenas recursos públicos na cache; notificações, dados de jogadores e respostas da API não são colocados na cache offline.

## Desafios, horários e decisão final do clube

O painel **Competição e jornadas** mostra o desafio desde a submissão: duplas, estado de aceitação/recusa, prazo de resposta, prioridade, histórico e estado da marcação. Ambos os administradores recebem avisos de novo desafio, aceitação/recusa e horário acordado; um desafio aceite pelos jogadores continua privado até à decisão do clube.

1. Uma dupla propõe data/hora no desafio aceite, com campo preferido opcional. A proposta já confirma a disponibilidade dessa dupla.
2. A outra dupla confirma ou recusa com motivo. Não há derrota automática por recusar um horário. Uma nova proposta reinicia as confirmações.
3. Com ambas as confirmações, o administrador escolhe o campo e usa **APROVAR E PUBLICAR JOGO**. Esta decisão valida, aprova e publica exatamente esse jogo na mesma transação. Os jogos anteriormente publicados ficam preservados; os restantes desafios continuam pendentes e as duplas ainda livres podem continuar a desafiar dentro do prazo.
4. As duas duplas recebem uma notificação **Jogo marcado pelo clube**, com adversários, dia, hora e campo e ligação ao jogo. Não há jogo nem aviso duplicado ao repetir o pedido.

O servidor bloqueia horários fora da jornada, campos ocupados, ausências, compromissos incompatíveis, ações de terceiros, versões desatualizadas e aprovação sem confirmação de ambas as duplas. A publicação guarda versão, administrador e datas de aprovação/publicação. Propostas coletivas do algoritmo continuam privadas e exigem aprovação e publicação explícitas. Alterações posteriores a jogos oficiais seguem a revisão auditada existente; resultados concluídos não podem ser alterados por uma revisão do calendário.

## Resultados e ranking semanal

Cada resultado **confirmado oficialmente** atualiza logo o ranking por troca direta se o atacante vencer; uma vitória do defensor mantém as posições. Resultados ainda pendentes/contestados não alteram o ranking. Os jogos já publicados mantêm as posições e regras do snapshot da jornada. Nos jogos de recuperação com duplas repetidas, os resultados confirmados são recalculados por ordem de horário e ID, independentemente da ordem de introdução. Fechar/liquidar a jornada conserva o mesmo resultado, sem repetir trocas.

O resumo do ranking semanal é publicado automaticamente **ao domingo às 20h, hora de Portugal**, apenas em épocas ativas. Guarda um snapshot no registo de atividade e notifica os jogadores ativos/aprovados na app e por push. Este resumo apresenta o ranking dos resultados já confirmados, sem inventar resultados nem alterar posições por calendário. **Regras** permite alterar o dia (0 = domingo), hora e ativar/desativar o automatismo. **Admin → Ranking → PUBLICAR RANKING SEMANAL E NOTIFICAR** permite antecipar o resumo. O envio é deduplicado por época/semana/jogador, incluindo quando a publicação manual antecede o automatismo. A publicação dos papéis semanais também notifica as respetivas duplas.

## Prazo de resposta e lembretes

O aviso inicial à dupla defensora indica o prazo já configurado no administrador (atualmente 48 horas = 2 dias) e a data/hora limite em Portugal. A app usa `respondBy` guardado no desafio; editar as regras não muda silenciosamente desafios existentes.

Enquanto o desafio estiver pendente, a dupla defensora recebe lembretes quando faltam **12, 6, 3 e 1 horas**. O worker verifica a cada minuto; se esteve parado, envia apenas o marco mais próximo em vez de acumular avisos antigos. Cada marco é deduplicado por desafio, prazo e destinatário. Aceitar, recusar ou cancelar termina os lembretes. Se o prazo terminar sem resposta, ambas as duplas e a organização recebem o aviso de expiração, sem criar um resultado fictício.

A fila volta a verificar o estado e o prazo antes de enviar, descartando avisos desatualizados após resposta, prolongamento ou expiração. O tempo de retenção do push de um lembrete não ultrapassa o prazo de resposta. Os membros guardados no snapshot de ambas as duplas têm acesso à respetiva entrega; não se assumem apenas os dois representantes. Desafios novos continuam bloqueados no servidor até à publicação dos papéis semanais.

## Duplas sem desafios

**Admin → Jornadas e emparelhamento → Participação nos desafios** mostra, por liga e jornada, as duplas que ainda não enviaram desafios e as que ainda não receberam desafios, além do total sem qualquer desafio. Cada entrada mostra a posição, nomes da dupla, papel e estado (aguarda resposta, aceite, jogo oficial, ausência ou inscrição inativa/pendente). As listas contam submissões reais, incluindo as posteriormente recusadas, expiradas ou canceladas; o estado distingue atividade passada de um compromisso atual. As duplas em DEFESA não são tratadas como obrigadas a iniciar desafios.

No modo semanal anterior, o mesmo acompanhamento está em **Papéis semanais → Duplas sem desafios enviados ou recebidos**, usando a semana e a categoria selecionadas. As listas são exclusivas do administrador e atualizam-se com o estado em direto existente. Não criam desafios, notificações ou alterações ao ranking.
