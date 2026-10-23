# Eventos de colocação e simulador de desafios

## Colocação inicial

Admin → Competição → **Eventos de colocação**. Escolhe época e divisão, cria um ou mais eventos com data e nome, e regista os jogos manualmente ou importa os resultados existentes no Excel. Os participantes são snapshots das equipas aprovadas nessa divisão, incluindo os parceiros. Não são criados novos jogadores nem desafios oficiais pela importação.

Cada jogo é em melhor de três sets: 2–0, 2–1, 0–2 ou 1–2. Regista também o total real de pontos marcados de cada lado. A ordenação é:

1. Diferença de sets acumulada, decrescente (sets ganhos menos sets perdidos). Um 2–0 contribui +2; um 2–1 contribui +1.
2. Pontos acumulados, decrescentes.
3. Empate completo: decisão explícita do administrador. A ordem atual serve apenas de pré-visualização até confirmar.

O significado de pontos é configurável por evento: total marcado (por exemplo, soma dos jogos dos sets se for esse o critério do clube) ou pontos de classificação, com valores editáveis por vitória/derrota. A opção inicial é total marcado. Não se inventam pontos em falta. Seleciona eventos com as mesmas regras, época, divisão e equipas para calcular a classificação acumulada. Quantidades diferentes de jogos geram um aviso.

A aplicação do ranking é uma ação separada, com confirmação. Todas as equipas precisam de pelo menos um jogo. Empates completos precisam de confirmação; as setas só mudam a ordem dentro de um empate. O servidor verifica versões, composição das equipas, posições protegidas, época atual e ausência de desafios/jornadas já criados. Não reescreve um campeonato em curso ou uma colocação já aplicada. Os eventos aplicados ficam fechados, com ordem final, administrador e timestamp. O ranking é alterado por equipa, com posições internas únicas e história para cada jogador; não altera vitórias/derrotas oficiais nem resultados, moedas ou previsões.

## Excel e CSV

Descarrega **Descarregar modelo Excel com equipas**. A folha `Equipas` contém os IDs e nomes atuais do snapshot. A folha `Jogos` contém estas colunas (a ordem pode variar):

| Jogo | Equipa A | Equipa B | Sets A | Sets B | Pontos A | Pontos B |
|---|---|---|---|---|---|---|

Usa o ID da equipa ou o nome exato. Um nome de jogador só é resolvido quando identifica uma única equipa. Nomes desconhecidos ou ambíguos geram um erro, sem criar contas ou escolher correspondências aproximadas.

`Jogo` é o identificador único do registo no ficheiro. Com o mesmo ID e resultado, a importação ignora o duplicado. O mesmo ID com outro resultado é bloqueado: remove o registo anterior de forma auditada antes de corrigir. Sem ID, gera-se uma chave pelo par de equipas e resultado, independente da orientação A/B. Para dois jogos realmente distintos com as mesmas equipas e resultado, fornece IDs distintos. Os IDs dos jogos não podem repetir entre eventos selecionados para a mesma classificação acumulada.

Formatos: `.xlsx` ou `.csv` (vírgula ou ponto e vírgula), até 5 MB e 500 linhas por importação; até 1000 jogos por evento. Não inclui fórmulas. Os tamanhos expandidos declarados do ZIP são verificados antes da leitura Excel. A pré-visualização mostra novos jogos, duplicados e erros por linha. Não há gravação antes de **Confirmar importação dos jogos**, e qualquer erro bloqueia essa confirmação. Se outro administrador alterar o evento, importa novamente para revalidar.

A aplicação do ranking não é automática depois de importar. É possível experimentar dados fictícios apenas na instância demo; não os introduzas na competição real.

## Simulador privado

Para desafios partilhados entre os dois administradores com notificações reais, usa o painel superior **Desafiar o outro administrador**. Ver docs/SHARED-ADMIN-TESTS.md. As opções automáticas abaixo continuam sem envios.

Admin → Competição → **Simulador de desafios**. As duas opções trabalham apenas em cópias em memória, sem gravar propostas, resultados, reservas ou notificações.

- **Submissão e aceitação de um desafio:** escolhe atacante/defensor; executa o motor real de desafios com a configuração e o estado atuais, e apresenta o passo válido ou a regra que o bloqueia. Testa estes dois passos; não testa reservas de campo, publicação ou confirmação de resultados.
- **Emparelhamento e resultados hipotéticos:** escolhe divisão, 1–10 jornadas e distância de teste. Opcionalmente carrega regras de uma jornada, marca indisponibilidades e fixa um jogo na primeira jornada. Simula todos os defensores a ganhar (ranking constante) ou todos os atacantes a ganhar (troca direta). Mostra pares, motivos/avisos, equipas sem jogo, erros e ranking posterior a cada jornada, mais distribuição de papéis. Usa o otimizador existente e o histórico confirmado. Este cenário não valida horários, pagamentos ou compromissos aceites da competição real; o relatório identifica essa limitação.

A seleção de jornada carrega regras de título/pesos; o campo de distância pode ser alterado só no teste. O cenário livre usa elegibilidade para o título nas posições 2 e 3. O simulador está limitado a 2–20 equipas, em linha com o otimizador existente. Administradores em espaço Jogador recebem 403 nos endpoints; eventos de colocação são privados na API do jogador. A simulação lê um snapshot consistente numa transação apenas de leitura antes de trabalhar em memória; não executa `mutate`, publicações ou envio externo de mensagens.

## Validação técnica

Coleção aditiva `placementEvents`, indexada por época/divisão/estado. As escritas usam o motor de domínio existente e as transações MongoDB, com versões otimistas e auditoria. Eventos mantêm snapshots que impedem a eliminação física de jogadores referenciados; a remoção lógica existente permanece disponível. Não há migração destrutiva.

Testes cobrem critérios e empates, parceiros, importação Excel/CSV e duplicados, permissões, concorrência MongoDB, não alteração do ranking durante importação/simulação, trocas diretas hipotéticas e validação do motor de desafios. A bateria de browser testa o fluxo admin, privacidade do jogador e largura móvel.
