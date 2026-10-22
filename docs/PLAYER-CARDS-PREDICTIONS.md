# Cartões de jogador e palpites

Estas funcionalidades não escrevem no ranking, nos papéis de jogo nem nas prioridades dos desafios. Não existe dinheiro, apostas, créditos compráveis ou prémios monetários.

## Cartões

Em **Cartões**, pesquisa um jogador ou filtra a liga. Os temas Ouro, Prata e Bronze são desenhos originais, sem logótipos ou recursos de entidades de jogos de futebol. O cartão mostra fotografia, nome, liga, rating e estatísticas verificáveis. **Partilhar cartão** usa a partilha de ficheiros do dispositivo; **PNG** descarrega uma imagem 720×1040 para partilha manual. Fotografias do próprio clube são incluídas na exportação; imagens externas indisponíveis para exportação dão lugar às iniciais.

Só entram jogos concluídos com um registo de resultado confirmado. Os contadores antigos do perfil não são usados como substituto de resultados inexistentes. Os participantes guardados no jogo mantêm a atribuição histórica mesmo após uma mudança de parceiro. Sem jogos confirmados, o rating é «—».

- Ataque: percentagem de vitórias nos jogos como atacante.
- Defesa: percentagem de vitórias nos jogos como defensor.
- Vitórias: percentagem de vitórias em todos os jogos confirmados.
- Forma: percentagem de vitórias nos últimos cinco jogos confirmados.
- Consistência: percentagem de participação nas últimas cinco jornadas publicadas e concluídas da liga. Jornadas futuras/incompletas não diminuem esta métrica. A métrica é participação, não uma garantia de presença sem ausências.
- Rating: média ponderada das métricas disponíveis. Pesos iniciais: ataque 25, defesa 25, vitórias 20, consistência 10 e forma 20. Métricas sem amostra são excluídas do numerador e denominador.
- Campeão: membros da equipa no topo atual do ranking.
- Equipa da jornada: vencedores com maior distância de ataque na última jornada completamente concluída de cada liga; uma defesa vale uma posição e empates recebem a distinção em conjunto. A distinção não cria pontos oficiais.

Em **Administração → Cartões e palpites**, os administradores podem alterar os pesos (inteiros 0–100, pelo menos um positivo). O cálculo é uma projeção dos resultados, pelo que atualiza automaticamente após confirmação/correção sem criar estatísticas duplicadas. As alterações ficam no registo de auditoria e usam controlo de versão para impedir sobreposição silenciosa entre administradores.

## Palpites

Apenas jogos com marcador explícito `officialPublication`, criado pela publicação aprovada da jornada, aparecem em **Palpites**. Aceitar um desafio, gerar uma proposta ou criar um jogo antigo não o publica implicitamente. Jogos sem horário confirmado não aceitam palpites.

Cada conta autenticada com perfil aprovado pode escolher uma equipa vencedora e o resultado em sets **2-0** ou **2-1**. Existe um único palpite por conta e jogo, editável até ao encerramento. Por defeito encerra no início do jogo; o administrador pode antecipar até 1440 minutos. O primeiro início conhecido é preservado: adiar o jogo não reabre palpites encerrados, incluindo para utilizadores sem um palpite anterior.

Pontuação inicial: **3 pontos pelo vencedor + 2 adicionais pelo resultado em sets**. O bónus exige também o vencedor correto. A configuração é guardada em cada novo palpite; editar um palpite existente conserva a pontuação original. Mudanças de regras não alteram palpites históricos nem resultados oficiais. Os palpites não envolvem qualquer valor monetário.

Os pontos só são atribuídos quando o jogo está concluído e existe um resultado oficialmente confirmado. Correções recalculam os pontos de forma idempotente; reabrir um resultado retira pontos provisórios e cancelar um jogo anula os palpites com zero pontos. Resultados antigos ambíguos dão apenas os pontos do vencedor, nunca um resultado em sets inventado. Formatos aceites incluem `2-0`, `2-1`, `6-4 6-2` e `6-4 3-6 10-8`.

A classificação dos palpites é separada, ordenada por pontos, vencedores certos, nome e identificador. Cada utilizador vê o seu histórico; os palpites individuais de outras contas não são expostos. O endpoint autenticado publica apenas os totais agregados e cartões sem email ou telefone. Os eventos de atualização em direto invalidam a vista e o componente conserva os filtros; existe também atualização periódica de 30 segundos.

## Armazenamento e segurança

São acrescentadas as coleções opcionais `engagementSettings` e `predictions`. Não é necessário reescrever dados antigos. O índice único `(userId, challengeId)` impede duplicados, além da transação de domínio que serializa os comandos. As escritas usam os comandos validados `prediction.save` e `admin.engagement.settings` através do endpoint existente `/api/league`, com autenticação e verificação de origem. GET `/api/engagement` não efetua escritas: projeta os resultados para evitar mostrar pontuações desatualizadas. A mutação de resultados confirma a liquidação persistente na mesma transação.

Testes em `tests/engagement.test.ts` cobrem publicação explícita, permissões, horários, reprogramação, unicidade, liquidação/correção, configurações e estatísticas verificadas. O teste de navegador `e2e/engagement.spec.ts` cobre os temas, exportação PNG, layout móvel, ausência de jogos privados e configuração administrativa.
