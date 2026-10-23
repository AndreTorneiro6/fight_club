# Eventos de colocação e simulador de desafios

## Colocação inicial

Admin → Competição → **Eventos de colocação**. Escolhe época e divisão, cria um ou mais eventos com data e nome, e regista os jogos manualmente ou importa os resultados existentes no Excel. Os participantes são snapshots das equipas aprovadas nessa divisão, incluindo os parceiros. Não são criados novos jogadores nem desafios oficiais pela importação.

Cada jogo é em melhor de três sets. Introduz as pontuações nas colunas Equipa A / Equipa B, por exemplo 6–4, 3–6, 10–8. Os sets ganhos e o total marcado são calculados a partir desses valores; o terceiro set só é necessário com 1–1. Os registos antigos que só têm totais continuam legíveis. Para corrigir, usa **Editar resultado** na linha do jogo e indica o motivo. As correções guardam antes/depois na auditoria e não alteram automaticamente o ranking. Uma edição concorrente preserva os campos locais e exige reabrir a versão atual. Eventos já aplicados permanecem fechados. A ordenação é:

1. Diferença de sets acumulada, decrescente (sets ganhos menos sets perdidos). Um 2–0 contribui +2; um 2–1 contribui +1.
2. Pontos acumulados, decrescentes.
3. Empate completo: decisão explícita do administrador. A ordem atual serve apenas de pré-visualização até confirmar.

O significado de pontos é configurável por evento: total marcado (por exemplo, soma dos jogos dos sets se for esse o critério do clube) ou pontos de classificação, com valores editáveis por vitória/derrota. A opção inicial é total marcado. Não se inventam pontos em falta. Seleciona eventos com as mesmas regras, época, divisão e equipas para calcular a classificação acumulada. Quantidades diferentes de jogos geram um aviso.

A aplicação do ranking é uma ação separada, com confirmação. Todas as equipas precisam de pelo menos um jogo. Empates completos precisam de confirmação; as setas só mudam a ordem dentro de um empate. O servidor verifica versões, composição das equipas, posições protegidas, época atual e ausência de desafios/jornadas já criados. Não reescreve um campeonato em curso ou uma colocação já aplicada. Os eventos aplicados ficam fechados, com ordem final, administrador e timestamp. O ranking é alterado por equipa, com posições internas únicas e história para cada jogador; não altera vitórias/derrotas oficiais nem resultados, moedas ou previsões.

## Excel e CSV

O novo modelo contém a folha Jogos com Jogo, Equipa A, Equipa B, Set 1, Set 2 e Set 3, mais a folha Equipas com IDs/nomes. Os modelos antigos com totais ainda são aceites. Até 5 MB e 500 linhas por folha de resultados, com pré-visualização e confirmação explícita antes de guardar.

Documentos completos exportados do Numbers são suportados: os cabeçalhos podem estar nas primeiras 25 linhas depois do título; folhas de resumo/ranking não são importadas. Quando há várias tabelas de resultados, escolhe **Folha de resultados**. A folha Duplas pode fornecer IDs externos e nomes; a associação usa as equipas já existentes no evento, sem criar jogadores. IDs/nomes contraditórios ou ambíguos geram erros. Jogos de outras divisões e jogos sem resultado são contados separadamente e ignorados.

Pontuações convertidas em datas exigem uma escolha explícita em **Interpretar datas nos sets**: dia–mês (6 de abril → 6–4) ou mês–dia (6 de abril → 4–6). Não se infere automaticamente a ordem. A pré-visualização mostra cada set recuperado e quantas células foram convertidas. Totais numéricos literais, quando presentes, têm de coincidir com os sets. Fórmulas de resumo são ignoradas e nunca executadas; fórmulas nos dados efetivamente importados são rejeitadas. Confirma as pontuações antes de guardar.

Duplicados iguais são ignorados. O mesmo ID com resultados diferentes bloqueia a importação: usa a edição auditada para corrigir. Sem ID, a chave deriva das equipas e resultado; para jogos distintos com resultados iguais, usa IDs diferentes. O detalhe de cada set é preservado. Qualquer erro ou versão desatualizada bloqueia a confirmação. Importar/editar altera apenas o evento de colocação; aplicar o ranking continua a ser uma ação separada.

## Simulador privado

Para desafios partilhados entre os dois administradores com notificações reais, usa o painel superior **Desafiar o outro administrador**. Ver docs/SHARED-ADMIN-TESTS.md. As opções automáticas abaixo continuam sem envios.

Admin → Competição → **Simulador de desafios**. As duas opções trabalham apenas em cópias em memória, sem gravar propostas, resultados, reservas ou notificações.

- **Submissão e aceitação de um desafio:** escolhe atacante/defensor; executa o motor real de desafios com a configuração e o estado atuais, e apresenta o passo válido ou a regra que o bloqueia. Testa estes dois passos; não testa reservas de campo, publicação ou confirmação de resultados.
- **Emparelhamento e resultados hipotéticos:** escolhe divisão, 1–10 jornadas e distância de teste. Opcionalmente carrega regras de uma jornada, marca indisponibilidades e fixa um jogo na primeira jornada. Simula todos os defensores a ganhar (ranking constante) ou todos os atacantes a ganhar (troca direta). Mostra pares, motivos/avisos, equipas sem jogo, erros e ranking posterior a cada jornada, mais distribuição de papéis. Usa o otimizador existente e o histórico confirmado. Este cenário não valida horários, pagamentos ou compromissos aceites da competição real; o relatório identifica essa limitação.

A seleção de jornada carrega regras de título/pesos; o campo de distância pode ser alterado só no teste. O cenário livre usa elegibilidade para o título nas posições 2 e 3. O simulador está limitado a 2–20 equipas, em linha com o otimizador existente. Administradores em espaço Jogador recebem 403 nos endpoints; eventos de colocação são privados na API do jogador. A simulação lê um snapshot consistente numa transação apenas de leitura antes de trabalhar em memória; não executa `mutate`, publicações ou envio externo de mensagens.

## Validação técnica

Coleção aditiva `placementEvents`, indexada por época/divisão/estado. As escritas usam o motor de domínio existente e as transações MongoDB, com versões otimistas e auditoria. Eventos mantêm snapshots que impedem a eliminação física de jogadores referenciados; a remoção lógica existente permanece disponível. Não há migração destrutiva.

Testes cobrem critérios e empates, parceiros, importação Excel/CSV e duplicados, permissões, concorrência MongoDB, não alteração do ranking durante importação/simulação, trocas diretas hipotéticas e validação do motor de desafios. A bateria de browser testa o fluxo admin, privacidade do jogador e largura móvel.

## Ranking provisório antes da competição

Seleciona os eventos e confirma a ordem dos empates. **Atualizar ranking provisório** atualiza as posições visíveis mantendo os jogos editáveis e os eventos em rascunho, incluindo quando ainda existem equipas/jogos sem resultado. Pode ser repetido quando chegarem novos resultados. **Aplicar ranking inicial** continua a ser a ação final que fecha os eventos. Nenhuma destas ações pode reescrever uma competição que já tenha desafios, propostas ou papéis oficiais publicados.

As férias da competição mantêm os seus registos. A opção **Aplicar proteção de férias também na colocação inicial**, por evento, está desligada por defeito porque a colocação antecede a competição oficial; quando ativada bloqueia deslocações protegidas. Isto não altera as regras de férias da liga.
