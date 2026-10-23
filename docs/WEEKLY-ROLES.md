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
