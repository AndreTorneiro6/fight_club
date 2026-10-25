# Desafios obrigatórios e confrontos definidos pela organização

## Semana de 26 de outubro de 2026

Os confrontos de Ouro e Prata indicados pelo administrador já estão atribuídos. Cada dupla deve abrir **Desafios**, selecionar o confronto da dupla e propor/aceitar um horário. Qualquer parceiro tem acesso ao mesmo desafio. Não é necessária aceitação do adversário. Novos desafios ficam impedidos pelo compromisso semanal de cada dupla.

Ouro 1–2 está adiado por ausência aprovada, com disponibilidade a partir de 16 de novembro. Isto não constitui uma reserva de campo. O horário de Prata 12–10 continua a aguardar a confirmação já existente do clube. Bronze não foi alterado.

## Regra publicada e ativa

A versão 91ec8bf foi publicada em 25 de outubro de 2026 e a regra está ativa. O administrador pode configurar em **Regras da competição → Desafios semanais obrigatórios · combinar apenas horário**. A opção apenas atua com a competição semanal ativa. O valor omitido/desativado preserva o funcionamento anterior.

Um novo desafio que cumpra as regras e a prioridade da fila fica imediatamente atribuído às duas duplas. As regras de divisão, papéis publicados, abertura, distância, campeonato e compromissos semanais continuam a ser verificadas no servidor. Os dois parceiros e a organização recebem o aviso adequado, sem pedido de aceitação em 48 horas. Horários iniciais são opcionais. A dupla adversária pode discordar do horário e propor outro; não pode recusar ou cancelar o confronto obrigatório. Apenas a organização pode cancelar com motivo auditado.

Os horários continuam a precisar da concordância de ambas as duplas e, quando configurado, da confirmação do clube antes de existir um jogo oficial. A atribuição não publica um jogo, não gera resultados e não muda o ranking.

Ativar a opção não converte desafios pendentes antigos. Um pedido novo não pode ultrapassar um pedido antigo prioritário: a organização deve resolver a fila primeiro.

## Operação administrativa de confrontos fixos

`planFixedWeeklyMatchups` cria um plano com impressão digital dos dados relevantes. `applyFixedWeeklyMatchups` exige administrador e essa mesma impressão digital, e deve ser chamada dentro de `transaction`. A operação é idempotente, cobre cada dupla uma vez, conserva confrontos compatíveis, bloqueia compromissos incompatíveis já aceites/propostos e cancela apenas pendentes incompatíveis. Todas as criações/aceitações/cancelamentos passam pelo motor existente. Uma cópia em memória evita alterações parciais se qualquer validação falhar. A reposição da pausa auditada e a atribuição de todos os confrontos acontecem na mesma transação.

O antigo relatório de reconciliação por primeira submissão foi substituído pela lista explícita desta semana. Não executar esse plano antigo nem a sua campanha de avisos.

## Marcação direta pelo administrador — publicada

Dentro do desafio atribuído, abrir **Intervenção administrativa → Marcar e confirmar jogo**. Definir **Data e hora**, **Campo** e **Duração · minutos**, rever a nota administrativa e clicar em **Confirmar marcação e notificar duplas**. Não são necessárias propostas ou confirmações de horário dos jogadores. A data/hora usa o fuso horário indicado no formulário.

O servidor confirma a reserva e avisa os membros das duas duplas. Conserva as validações de campo ativo, conflitos de reservas/jogadores, ausências, adiamento e prazo da jornada. Não permite marcar um adversário ainda pendente de atribuição, nem contornar o circuito de revisão/publicação das jornadas geridas. A nota e a decisão do admin ficam no histórico; não são inventadas confirmações dos jogadores. Se outro admin alterar o desafio enquanto o formulário está aberto, a confirmação antiga é bloqueada e exige atualização.

Esta extensão foi publicada na versão e5a23ad em 25 de outubro de 2026, após todas as verificações e testes de navegador.

## Primeira semana competitiva e agenda — atualização preparada

A época 1 tem **26 de outubro de 2026** guardado como primeira semana competitiva. A abertura da época em 24 de outubro mantém-se para permitir preparação e desafios. O registo de papéis de 19 de outubro fica preservado, fora da competição.

Após publicar a atualização preparada, **Épocas → Editar → Primeira semana competitiva · segunda-feira** permite gerir este limite. Agenda de jogos, calendário dos desafios, papéis semanais e cartazes começam nessa semana, com numeração Jornada 1. O admin pode escolher as semanas seguintes, mas não retroceder à preparação. Alterações que excluam jogos/desafios existentes são bloqueadas.

A agenda abrirá em **Jogos da liga**, na semana do próximo jogo confirmado, mantendo **Meus jogos** para filtrar a dupla. Os jogos já marcados estavam disponíveis no servidor; os filtros iniciais da semana e da dupla é que os ocultavam.
