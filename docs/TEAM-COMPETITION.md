# Competição por duplas

## Decisões e compatibilidade

As contas e os perfis continuam individuais. A identidade competitiva é o conjunto ordenado de IDs dos membros da dupla, dentro da divisão. As relações com `partnerId` têm precedência; mantém-se a resolução recíproca por nome para registos antigos, sem alterar a composição nem regravar os dados históricos.

A posição pública é o índice da dupla no ranking da divisão. Ambos os parceiros veem a mesma posição. Os campos antigos `Player.position` e `previousPosition` continuam como ordinais internos únicos para compatibilidade com colocações, arquivos e ordenação; não se convertem em posições duplicadas. `teamPosition` e `previousTeamPosition` são derivados no API. Novos desafios guardam posições de equipa e IDs de ambas as duplas, com o modelo de snapshot explícito. Snapshots antigos não são reinterpretados nem reescritos.

## Fila e compromissos

Existe uma fila por dupla que inclui desafios enviados e recebidos, de qualquer parceiro. Um desafio só pode ser aceite quando tem prioridade para ambas as duplas. A ordem normal é data, número e ID; a rotação regulamentar da prioridade disputada continua a ser aplicada, numa ordem global determinística para evitar ciclos. Um pedido posterior não pode ultrapassar um pedido anterior da própria dupla apenas por ter outro adversário ou outro parceiro como remetente.

Podem existir pedidos pendentes em ambas as direções durante Ataque Livre, com os limites configurados. Pendência não publica um jogo. Compromissos já aceites/publicados mantêm-se protegidos. A aceitação encerra apenas pedidos pendentes incompatíveis, com motivo, aviso e auditoria. Pedidos antigos não são apagados para corrigir a prioridade. Expiração, recusa válida e cancelamento libertam a fila; não criam resultados fictícios.

## Permissões e notificações

Qualquer membro da dupla pode consultar o mesmo desafio, responder em nome da sua dupla, propor/aceitar horários e acompanhar o histórico. Os horários usam um proprietário canónico por lado; `offeredBy` conserva a pessoa que executou a ação. Um parceiro não pode confirmar em nome do adversário. Os dois membros de cada dupla recebem os eventos partilhados (envio, receção, aceitação, marcação e resultado), com o mesmo desafio e prazo. Preferências/credenciais e fotografias continuam pessoais. Mensagens de administração privadas não são tornadas públicas.

## Ranking e resultados

Uma vitória atacante aplica o modelo configurado à dupla inteira. Troca direta troca as duas duplas, conservando a posição competitiva das intermédias; o modelo alternativo configurável respeita equipas protegidas. Estatísticas novas são creditadas aos membros de ambos os lados, com metadados para desfazer apenas os créditos realmente aplicados por esta versão. Correções históricas não inventam participações. Promoções/despromoções contam duplas e transferem todos os seus membros em conjunto.

## Riscos e resolução

- Há snapshots/registos antigos com posições individuais: preservá-los e distinguir o modelo; não fazer uma migração destrutiva de posições.
- Alterações de composição com desafios ativos ficam bloqueadas. A identidade histórica de um desafio vem do snapshot, não do nome atual.
- Pedidos pendentes já criados são avaliados pela nova fila à leitura/ação, preservando a hora original. Aceitações/jogos anteriores nunca são revertidos automaticamente; eventuais conflitos vão para revisão administrativa.
- Administradores podem alterar a posição da dupla inteira; um payload antigo não pode deslocar só um parceiro.
- A confirmação do clube continua separada da aceitação do desafio/horário. Rascunhos oficiais permanecem privados.
