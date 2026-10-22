# Dinheiro virtual — teste privado

Admin → Configuração → **Moedas e bar**. Só o espaço Admin tem acesso, tanto na interface como no backend; os jogadores ainda não recebem esta interface. A funcionalidade começa desativada. Os dois administradores partilham configuração, carteiras e histórico.

## Configurar e testar

1. Ativar o teste privado e guardar. Editar o nome e o número de moedas por jogo marcado (valor inicial sugerido: 10; zero desativa novos ganhos por marcação).
2. Adicionar recompensas ao catálogo, definir o custo e a disponibilidade e guardar. O catálogo começa vazio; não há produtos ou benefícios prometidos por defeito.
3. Escolher uma carteira. Para eventos ou outras formas de participação, registar um movimento positivo com motivo. Movimentos negativos permitem corrigir atribuições, com saldo suficiente e histórico preservado.
4. No clube, escolher a recompensa e confirmar a entrega. O saldo é debitado uma única vez, com identificação do administrador, nome e preço da recompensa nessa data. Estas trocas são entregas presenciais, não vales para utilização posterior.

Não há compras de moedas, transferências entre jogadores, apostas, prémios em dinheiro ou levantamento. Os palpites existentes não atribuem nem consomem moedas. As moedas não alteram o ranking, os resultados, os papéis nem as prioridades dos desafios.

## Ganhos e cancelamentos

Cada participante do snapshot do desafio ganha as moedas quando existe uma marcação efetiva, com horário e registo do jogo. Uma proposta por confirmar não conta. Uma alteração pendente de um jogo já marcado mantém o ganho original. Publicar um emparelhamento sem horário não conta.

Não existe crédito retroativo quando se ativa a funcionalidade, por jogos antigos ou por importação de resultados concluídos. Cada desafio conserva o valor e os participantes do primeiro crédito. Alterar o horário não cria outro ganho. Cancelar, expirar ou remover a marcação gera um movimento inverso, mesmo com o teste desativado. Remarcar o mesmo desafio repõe apenas o valor original. Alterações à configuração aplicam-se a novos créditos.

Se as moedas tiverem sido gastas antes do cancelamento, a anulação pode deixar um saldo negativo explícito. Novos ganhos compensam esse valor e novas trocas ficam bloqueadas enquanto não houver saldo suficiente. O histórico não é apagado nem reescrito. Um administrador pode corrigir o saldo com motivo.

## Persistência

Coleções aditivas `coinSettings` e `coinEntries`, com índices de pedido único e histórico por jogador. Saldos são calculados a partir de movimentos imutáveis. Todas as alterações passam pelo motor de domínio e pela transação MongoDB serializada existente, incluindo a reconciliação de marcações por ações e tarefas automáticas. `expectedVersion`, `expectedBalance` e `requestId` evitam alterações concorrentes e duplicação de pedidos. Uma conta com movimentos não pode ser eliminada definitivamente; mantém-se a remoção com histórico.

As coleções antigas não precisam de migração destrutiva. Na primeira leitura as novas coleções estão vazias. Os índices são criados pelo arranque normal.
