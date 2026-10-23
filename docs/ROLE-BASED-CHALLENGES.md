# Papéis da jornada e resultado por set

## Operação

Em **Admin → Competição e jornadas**, seleciona a época, liga e jornada. Na secção **Papéis e acesso aos desafios**, guarda um rascunho ou publica **ATAQUE / DEFESA**. Os rascunhos são privados. O campeão deve defender e a última dupla deve atacar. O painel permite pré-visualizar os adversários antes de publicar. Os papéis são atribuídos por dupla, com o ranking e a composição guardados na publicação. Publicar papéis não publica jogos.

Antes da publicação podes alterar os papéis. Depois, ficam preservados para essa jornada. Alterações concorrentes exigem atualizar a versão. Para suspender temporariamente a submissão/resposta, usa **Bloquear desafios**; **Reabrir desafios** exige um motivo. Cancelar um compromisso também exige um motivo. As intervenções ficam na auditoria e no histórico dos desafios afetados.

Em **Jornadas**, as duplas em ataque veem apenas adversários elegíveis em defesa, a posição, distância, disponibilidade e último encontro. As duplas em defesa veem os desafios recebidos. A prioridade é calculada no servidor antes de filtrar os dados de cada jogador: primeira submissão válida, com rotação do benefício disputado na jornada anterior. Uma aceitação existente fica protegida e conserva o motivo de prioridade, mesmo se os restantes desafios expirarem antes da publicação. Na semana livre, um desafiante que aceite defender noutro jogo deixa de poder ocupar uma segunda vaga; a prioridade avança para o próximo pedido válido. O defensor não pode aceitar ou recusar um desafio sem prioridade para escolher outro.

A resposta pode incluir uma proposta de horário, mas essa mensagem não reserva um campo nem confirma um jogo. Aceitar bloqueia compromissos incompatíveis; não cria um jogo oficial. A recusa exige um motivo e não cria uma derrota. O prazo segue a configuração da liga (48 horas por defeito).

Em **SEMANA DE ATAQUE LIVRE**, todos exceto o campeão podem iniciar desafios para cima, independentemente do papel publicado. Podem também receber desafios. A aceitação ocupa a vaga normal de ambas as duplas. Ausências aprovadas, regras do título, distância e compromissos continuam a aplicar-se.

A organização recebe um aviso deduplicado por dupla/jornada quando não há alvos disponíveis. São usados os canais e consentimentos já existentes. Os jogadores não recebem informação sobre propostas administrativas privadas.

O administrador continua a usar **Gerar confrontos**, edição manual, validação, aprovação e publicação separada. A publicação de papéis invalida a aprovação de uma proposta anterior e volta a validar os papéis dos jogos. O otimizador respeita os papéis publicados nas semanas normais; não força a rotação nas semanas livres.

## Fluxo semanal anterior

O painel semanal anterior mantém as competições ainda não migradas para jornadas geridas. Também valida ATAQUE/DEFESA no servidor, permite desafios pendentes concorrentes ao mesmo defensor e aplica prioridade na resposta. As férias pessoais nesse fluxo mantêm o adiamento já existente; não são uma ausência aprovada da competição gerida. Para as ligas geridas, publica os papéis no painel da jornada, não no painel semanal anterior.

## Resultado por set

Em **Registar resultado** ou **Corrigir resultado**, preenche os jogos de cada set nas colunas **ATAQUE / DEFESA**. A ordem é sempre a das duplas do desafio, mesmo quando a defesa ganha. São necessários dois sets ganhos; o terceiro só existe com 1–1. Aceita 6–0 a 6–4, 7–5, 7–6 e super tie-break no terceiro set (10 pontos, vantagem mínima de dois, incluindo prolongamentos).

O vencedor escolhido tem de corresponder aos sets. A pontuação estruturada é guardada no desafio e no resultado confirmado; a representação textual mantém a compatibilidade com histórico, exportações e palpites. As correções preservam a pontuação anterior na auditoria. Jogos antigos continuam legíveis sem inventar pontuações por set a partir de um total 2–0/2–1. As chamadas antigas sem pontuação estruturada continuam suportadas.

## Dados e segurança

Migração aditiva: campos opcionais nos documentos de jornadas, desafios e resultados. Nenhuma coleção ou resultado existente é apagado ou reordenado. Os comandos usam as transações MongoDB e a auditoria existentes. Novas submissões requerem papéis publicados, jogador ativo da liga e época ativa, janela da jornada e validação do snapshot. A API rejeita pedidos diretos que tentem ultrapassar os papéis. As respostas revalidam elegibilidade, compromisso e prioridade.
