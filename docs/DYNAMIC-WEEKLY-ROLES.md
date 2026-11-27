# Assistente semanal de papéis e adversários

Comportamento de v2.2.0, preparado em 27/11/2026. O assistente está sempre ativo em todas as divisões com competição semanal; a decisão do administrador prevalece sobre ele. Este documento descreve o código; não confirma a configuração nem a versão em produção. As jornadas oficiais geridas em Competição e jornadas mantêm o seu fluxo próprio.

## Rascunhos e papéis

O assistente prepara rascunhos, sem publicar nem abrir desafios. Nas semanas normais troca Ataque por Defesa e Defesa por Ataque. Usa o lado realmente assumido num jogo da semana anterior; sem jogo, usa o papel guardado. Para semanas futuras ainda por publicar, usa o rascunho anterior como previsão e atualiza rascunhos gerados que ainda não foram editados.

A primeira dupla defende sempre e a última ataca sempre. Nas semanas de ataque livre, todas as outras duplas ficam em Ataque e podem desafiar ou receber desafios. Fora dessas semanas, Ataque só desafia, Defesa só recebe e Combo pode fazer ambos.

Uma edição administrativa deixa de ser um rascunho automático: não é substituída por uma atualização do assistente. Papéis publicados permanecem guardados. Um compromisso não transforma os papéis de outras duplas; o lado assumido no jogo fica no histórico para a rotação seguinte.

## Alcance e prioridade

A distância configurada é o alcance normal. O assistente procura a maior cobertura possível sem trocar os papéis e, entre os planos com essa cobertura, prefere o menor número de confrontos alargados e depois a menor distância adicional. As extensões necessárias podem aparecer antes do primeiro desafio, em Ouro, Prata e Bronze. O alcance do título também pode ser alargado quando necessário para essa cobertura.

Uma dupla sem adversário livre dentro do alcance pode desafiar a dupla livre mais próxima acima, mesmo que isso não acrescente um jogo ao plano; o primeiro desafio enviado tem prioridade. Esta abertura não inclui a primeira dupla fora do limite do título e não altera o plano sugerido. Os confrontos criados ou reatribuídos pelo administrador não são recusados pelo assistente nem pelo alcance.

Os desafios válidos dentro do alcance normal ficam disponíveis, mesmo que não pertençam a uma combinação preferida pelo assistente. O primeiro desafio válido confirmado no servidor é preservado. Depois dele, o assistente recalcula as opções das restantes duplas, sem criar jogos adicionais. Não reserva adversários só porque pertencem a um plano preferido. O plano sugerido ajuda o administrador a avaliar a cobertura; não obriga os jogadores a segui-lo.

As regras de divisão, participação, posição acima, repetição da semana anterior e compromissos existentes continuam validadas no servidor. Se os papéis não permitirem mais jogos, mesmo com alcance alargado, o sistema assinala a situação em vez de trocar papéis. A publicação e abertura dos desafios continuam controladas pelo administrador.

## Jogos obrigatórios escolhidos pelo administrador

Não existe seletor entre administração e algoritmo. O administrador define apenas os pares necessários; as outras duplas continuam no fluxo normal. Guardar um novo jogo obrigatório atribui-o imediatamente, sem publicação adicional, e reserva apenas as duas equipas escolhidas nessa semana. A partir desse momento começa o prazo de 12 horas, exclusivo desse par e sem alterar os prazos dos outros jogos. Se atravessar o fim da semana, o prazo continua válido: o novo desafio conserva a semana original e pode ser marcado na semana de confirmação, sem alterar jogos existentes. Rascunhos de versões anteriores continuam identificados como jogos guardados, sem reservar equipas; a ação Atribuir jogo ativa apenas o par escolhido, sem ativar os outros rascunhos.

Só os parceiros da dupla atacante veem a atribuição e recebem o aviso de atribuição. Qualquer um deles pode confirmar em Desafios durante 12 horas. A dupla em defesa espera pelo desafio real. Se o prazo terminar, o worker cria o desafio através do mesmo comando validado. Ambas as duplas recebem então a notificação e combinam o horário; a marcação mantém as confirmações exigidas pelo clube.

Voltar a atribuir o mesmo par já ativo não reinicia o prazo nem duplica o desafio. Uma atribuição que deixou de ser válida exige revisão administrativa; não ultrapassa as validações. A administração pode retirar uma atribuição antes da criação do desafio. Em Gerir semanas, os cartões de ambas as equipas mostram o adversário atribuído e a confirmação pendente em vez de indicar que não existe jogo possível. Esta informação é administrativa; a defesa continua sem pré-visualização do adversário.

## Jogos congelados e compromissos

Os jogos aceites, em marcação, marcados ou concluídos mantêm as suas duplas e prioridade. Os jogos congelados mantêm a semana original, os participantes e as datas de adiamento. Os jogos já marcados mantêm as duplas, a data, a hora e o campo. O assistente não cancela, substitui, duplica nem recria esses jogos.

Um jogo adiado de uma semana anterior não impede por si só um novo jogo semanal com outro adversário, mas o confronto ainda por resolver não pode ser repetido entre as mesmas duplas. Jogadores de férias podem receber desafios; o jogo fica adiado até ao regresso. Alterar o alcance não reescreve os valores guardados em confrontos anteriores.

## Validação

Os testes cobrem alternância por lado assumido, rascunhos futuros sucessivos, preservação de edições administrativas, alcance alargado antes e depois do primeiro desafio, Ataque livre, exclusões, reservas obrigatórias e privacidade da defesa. O teste Mongo confirma que dois pedidos concorrentes produzem um único vencedor, sem jogos adicionais. Regressões de jogos congelados comparam o registo completo antes e depois de novos desafios, geração de rascunhos e processamento de prazos.

## Contagem decrescente por divisão

Em Admin → Papéis semanais → Intervalo entre os papéis e a abertura, escolher divisão e minutos. Num rascunho, guardar o intervalo antes de aprovar: a contagem começa apenas na publicação administrativa. Se os papéis já estão publicados, **Ativar contagem desta divisão** começa o intervalo nesse momento. Sem ativação, a Bronze mantém a espera pelo administrador. Também é possível indicar dia/hora exatos no formulário existente.

Admin e jogadores veem o mesmo prazo em hora de Portugal, atualizado a cada segundo. A autorização permanece no servidor, e o aviso de abertura existente é enviado uma única vez quando chega a hora. Esta funcionalidade serve Ouro e Prata nas próximas jornadas, sem alterar os jogos atuais. Não existe intervalo universal imposto: cada administrador escolhe o valor.
