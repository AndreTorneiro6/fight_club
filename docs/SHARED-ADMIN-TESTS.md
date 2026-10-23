# Testes partilhados entre administradores

Admin → Competição → Simulador de desafios → **Desafiar o outro administrador**.

1. Cada administrador entra com a sua própria conta e escolhe o espaço Admin.
2. Ambos abrem o simulador. Para push, cada um abre **Ativar push neste dispositivo** e autoriza as notificações. No iPhone, usa a app instalada e as permissões de notificações do sistema.
3. Um escolhe o outro administrador, escreve uma mensagem opcional e clica **Enviar desafio de teste**.
4. O destinatário recebe uma notificação `TESTE · Desafio de teste enviado` e vê **Aceitar teste / Recusar teste**, com atualização em tempo real.
5. Depois da aceitação, um propõe um horário futuro e o outro confirma. É apenas um horário de teste; não há reserva de campo.
6. Um submete um resultado de teste e o outro confirma. Os avisos de cada passo chegam apenas ao outro participante.
7. Usa o sino/Notificações para consultar os avisos. **Abrir teste** volta ao simulador; Entregas externas mostra os estados da fila. Pode cancelar-se um teste que ainda não terminou.

Notificações na app são sempre criadas. Por defeito só o canal externo push é escolhido. Email e WhatsApp exigem seleção explícita e continuam a respeitar a configuração do serviço, as preferências/consentimento e a disponibilidade do destinatário. Twilio sandbox só envia para números que aderiram ao sandbox e requer o template configurado na integração existente. A inexistência de subscrição push significa que não há dispositivo para receber essa entrega. Os testes automáticos verificam a fila, mas não substituem uma confirmação de receção num telefone real.

Os testes partilhados gravam apenas registos próprios (`adminTestChallenges`), notificações e auditoria. Não criam desafios/jogos oficiais, pagamentos, reservas, resultados de competição ou alterações no ranking, moedas, estatísticas ou palpites. Não há validação de distância de ranking entre os dois administradores: são testes de interação, separados do motor competitivo. A simulação automática anterior continua disponível abaixo, sem notificações.

O servidor deriva os destinatários de contas verificadas com papel admin, dentro da mesma transação que valida cada comando. Apenas os dois participantes podem agir ou ver o registo no simulador. O destinatário aceita; quem propõe horário/resultado não pode confirmar a própria proposta. O espaço Jogador não recebe estes registos nem as notificações na app. O emissor usa a identidade da sessão, sem possibilidade de se fazer passar pelo outro admin. IDs de pedido, versões otimistas, índice único e fila de entregas previnem duplicações. A autorização e os canais escolhidos são revistos novamente antes de uma entrega externa atrasada.

Validação inclui testes do motor, concorrência/persistência MongoDB, encaminhamento de notificações, revogação de papel admin antes do envio e browser com duas contas diferentes em sessões separadas. O segundo admin fictício é promovido apenas pelo runner demo com `--test` e `DEMO_TEST_ADMIN_PAIR=1`; não altera o seed de produção ou a demo normal.
