# Reconciliação pontual de desafios por dupla

Estado: implementado e validado localmente. Não publicado, não aplicado em produção e sem notificações enviadas.

A operação conserva o primeiro envio de cada dupla na jornada, considerando ataque e defesa e os dois parceiros. A ordem é o instante absoluto de criação, seguido do número/ID em caso de empate. Um pedido posterior que partilhe uma dupla com um desafio conservado é proposto para cancelamento. Um pedido cancelado não reserva outras duplas nem provoca cancelamentos em cadeia sem conflito real.

Este é um procedimento pontual de limpeza: também abrange pedidos em fila que entrem em conflito com o primeiro envio, não apenas dois envios feitos pelos parceiros. Não altera a regra normal de permitir pedidos pendentes em ambas as direções ou a rotação de prioridade das semanas seguintes.

## Preparar e rever

Usar uma cópia sanitizada obtida por leitura (jogadores sem emails, telefones, credenciais ou fotos; desafios e relações competitivas). A ferramenta de pré-visualização só lê/escreve ficheiros locais, não importa MongoDB nem envia mensagens:

```bash
npx tsx scripts/preview-challenge-reconciliation.ts snapshot.json season-1 2026-10-26 plan.json
```

O plano inclui os pedidos mantidos/cancelados, motivos, conflitos para revisão, destinatários e textos de notificações. A impressão digital identifica os dados revistos. Uma alteração nos pedidos, compromissos, prazo ou identidade das duplas exige uma nova simulação.

## Aplicação futura, apenas após autorização

Nenhum passo de deploy ou tarefa automática aplica este plano. A aplicação exige uma ação administrativa explícita, pela infraestrutura existente de `mutate`/transação MongoDB:

- Pré-visualização: `admin.challenges.reconciliation.preview`, com `seasonId`, `weekStart` (segunda-feira) e `divisionId` opcional.
- Aplicação: `admin.challenges.reconciliation.apply`, com o mesmo âmbito, `fingerprint` revisto, `operationId` único, `reason`, `confirmation: "RECONCILIAR"` e `notifyPlayers: true`.

Só administradores podem executar. O servidor recalcula o plano dentro da transação e rejeita dados desatualizados. A mesma operação repetida não cancela nem notifica novamente. A serialização existente protege alterações simultâneas por dois administradores.

Pedidos posteriores aceites, com horário/proposta de marcação, publicação, pagamento de campo ou resultado exigem revisão. Qualquer conflito protegido ou identidade ambígua bloqueia toda a aplicação. Jornadas do modelo gerido usam o seu próprio processo oficial e não são alteradas por esta operação.

Os cancelamentos preservam os registos, disponibilidades, mensagens e ligações ao primeiro desafio, com auditoria e motivo. Não criam derrotas, multas ou resultados; não alteram ranking nem jogos confirmados. Os prazos dos desafios mantidos não são reiniciados.

A operação prepara um único aviso por jogador ativo do âmbito, personalizado com os seus desafios mantidos/cancelados, em app/push através da outbox existente. Há um resumo para os administradores. Não há envio WhatsApp ou email. A entrega push respeita as subscrições e preferências existentes.

## Validação

310 testes, typecheck e build passaram. A cobertura nova inclui pré-visualização sem mutações, ordem temporal/UTC, parceiros e lados diferentes, âmbito de época/divisão, preservação de histórico/ranking/horários/resultados, proteção de compromissos/pagamentos, permissões, rejeição de plano obsoleto e idempotência. Um teste com réplica MongoDB confirma duas aplicações simultâneas sem cancelamentos ou avisos duplicados.
