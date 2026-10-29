# Plano final — Caderneta e trocas de cromos da comunidade

Estado: implementação local autorizada em 29 de outubro de 2026 pelo pedido “implement both”. Inclui negociação e trocas de vários cromos desde a primeira versão. Publicação apenas após pedido do utilizador, conforme a fase 6. Ver STICKER-ALBUM.md para operação e validação.

## 1. Objetivo e ponto de partida

Criar uma caderneta da liga onde os jogadores possam abrir saquetas, completar a coleção e negociar cromos repetidos com a comunidade.

A implementação atual está em prévia para administradores. Já tem saquetas diárias configuráveis, cromos repetidos, progresso e vales de recompensa. As quantidades são calculadas a partir das saquetas abertas; ainda não existe um inventário que registe transferências. Essa base deve ser preparada antes das trocas.

Cada conta terá uma única coleção por época, partilhada entre os espaços de jogador e administrador. Mudar de espaço não concede saquetas extra, nem permite negociar consigo próprio.

## 2. Regras das trocas

- Permitir **1 por 1, 1 por 2, 1 por 3, 2 por 3 e outras combinações**, desde a primeira versão.
- Cada lado escolhe os cromos e as quantidades que entrega. Os dois lados devem entregar pelo menos um cromo.
- O valor da troca é acordado pelos jogadores: a aplicação não impõe uma equivalência entre quantidades ou jogadores representados.
- Trocar apenas exemplares repetidos, mantendo sempre pelo menos um exemplar de cada cromo na coleção.
- Permitir vários exemplares do mesmo cromo numa proposta, desde que existam repetidos suficientes e seja preservado o último exemplar.
- Trocas apenas entre contas diferentes, de jogadores aprovados e ativos, dentro da mesma época.
- Proposta inicial de limites: até **10 exemplares de cada lado**, **5 negociações pendentes iniciadas por conta** e **72 horas de validade**. Estes valores serão configuráveis pelos administradores.
- A negociação envolve cromos; pagamentos, moedas da aplicação e promessas externas não fazem parte do acordo executado pelo sistema.

Exemplo: a Ana oferece **1 Pedro Costa** e pede **1 João Silva + 1 Luís Santos**. O Bruno pode aceitar ou propor receber o Pedro Costa em troca de **3 outros cromos**. A aplicação apresenta sempre os cromos concretos e as quantidades, sem atribuir preços.

## 3. Organização da caderneta

Entrada própria **Caderneta**, com destaque no telemóvel, saqueta disponível e acesso rápido às propostas recebidas.

- **A minha caderneta:** cromos obtidos e em falta, organizados por divisão, com progresso da coleção.
- **Repetidos:** quantidade total, exemplares disponíveis para troca e exemplares reservados.
- **Comunidade:** jogadores disponíveis para negociar e sugestões úteis para completar a coleção.
- **Negociações:** propostas recebidas, enviadas e conversas em curso, com indicação de quem tem de responder.
- **Histórico:** trocas concluídas, recusadas, canceladas, expiradas ou invalidadas.

A descoberta na comunidade será opcional. Ao ativar “Disponível para trocas”, o jogador permite mostrar os seus repetidos disponíveis e as oportunidades de troca relevantes. A comunidade não terá acesso ao inventário completo, contactos, histórico de saquetas ou recompensas de terceiros.

Pausar novas propostas retira o jogador da descoberta e impede novos convites, mantendo as negociações existentes acessíveis para conclusão ou cancelamento.

## 4. Negociação por chat e contrapropostas

Cada negociação terá uma conversa privada entre os dois jogadores, associada à proposta. Assim podem perguntar, combinar quantidades e fazer contrapropostas de 1 por 2, 1 por 3 ou qualquer combinação permitida.

Fluxo:

1. Escolher os cromos e quantidades a oferecer.
2. Escolher os cromos e quantidades pretendidos do outro jogador.
3. Rever o resumo “Dás / Recebes” e enviar a proposta.
4. O destinatário pode **aceitar, fazer contraproposta, conversar ou recusar**.
5. Uma contraproposta cria uma nova versão do acordo, apresentada de forma clara na conversa.
6. O outro jogador revê essa versão e aceita ou continua a negociar.
7. Ao aceitar, todos os cromos são transferidos em conjunto e ambos recebem um comprovativo.

**Uma mensagem de chat não confirma nem executa uma troca.** A confirmação é sempre feita no botão “Aceitar esta proposta”, junto ao resumo exato e atual dos cromos.

Enviar uma versão significa concordar com essa versão. Apenas a outra pessoa a pode aceitar. Uma contraproposta substitui o acordo anterior e invalida qualquer aceitação antiga. Nunca se pode aceitar uma versão desatualizada, nem aceitar a própria contraproposta.

As mensagens ficam associadas à negociação, com indicação das alterações à proposta. A conversa deixa de aceitar novas mensagens quando a negociação termina; o histórico continua disponível para os participantes.

## 5. Reservas, disponibilidade e validade

Reservar apenas os cromos que o autor da proposta atual se compromete a entregar. Os cromos pedidos à outra pessoa não ficam reservados sem o seu consentimento.

Uma contraproposta substitui a reserva anterior pela reserva dos cromos oferecidos pelo novo autor, numa única operação. Se a nova reserva não for possível, a contraproposta falha e a proposta anterior mantém-se válida.

Na aceitação, verificar novamente a versão da proposta, as contas, a época e todas as quantidades dos dois lados. Cromos reservados noutras negociações não estão disponíveis para esta troca. Em nenhuma operação se pode entregar o último exemplar.

Se faltarem cromos, a aplicação não executa uma troca parcial: explica o problema, invalida a proposta indisponível e liberta a respetiva reserva. Os jogadores podem iniciar uma nova proposta com o inventário atualizado.

A validade será de 72 horas desde a última proposta ou contraproposta. Mensagens de chat não prolongam esse prazo. Cancelamento, recusa, expiração ou suspensão de uma conta libertam as reservas. O encerramento da época impede novas aceitações e termina as propostas pendentes.

Estados apresentados: **A aguardar resposta, Concluída, Recusada, Cancelada, Expirada e Invalidada**. As versões substituídas permanecem no histórico, sem poderem ser aceites.

## 6. Sugestões da comunidade

Dar prioridade a combinações em que cada jogador tenha repetidos que faltem ao outro. Mostrar quantos cromos diferentes cada lado pode ganhar e permitir ajustar livremente o conjunto proposto.

As sugestões ajudam a encontrar parceiros; não obrigam a uma troca equivalente em quantidade e não impedem uma proposta diferente entre jogadores elegíveis.

Não associar o valor de um cromo à classificação desportiva do jogador representado. Caso existam edições especiais ou raridades no futuro, terão de ser definidas explicitamente, sem inventar diferenças na coleção atual.

## 7. Notificações e convivência

- **Nova proposta:** notificar o destinatário.
- **Contraproposta:** notificar quem tem de responder, mostrando que os termos mudaram.
- **Mensagem no chat:** notificar apenas a outra pessoa, respeitando o silêncio da conversa e agrupando mensagens próximas para evitar excesso de avisos.
- **Troca concluída:** notificar o autor da versão aceite; ambos veem o comprovativo na aplicação.
- **Recusa, cancelamento ou expiração:** avisar a outra parte quando relevante, sem notificações repetidas.

Tocar na notificação abre diretamente a negociação ou a mensagem correspondente. Respeitar as preferências de entrega existentes. Não enviar avisos à comunidade inteira nem notificar alguém por simplesmente visitar uma caderneta.

Incluir opções para silenciar uma conversa, bloquear novas negociações com uma pessoa e denunciar uma negociação. O bloqueio termina propostas pendentes entre as duas contas e liberta reservas. As mensagens e os comprovativos permanecem no histórico; denúncias podem ser analisadas por administradores autorizados, com acesso registado.

## 8. Inventário, histórico e segurança das transferências

Manter as saquetas já abertas como registos imutáveis. Acrescentar:

- **Inventário:** conta, época, cromo, quantidade total e quantidade reservada.
- **Registo de movimentos:** entradas de saquetas e transferências de trocas, identificando a origem de cada movimento.
- **Negociações:** participantes, versões da proposta, listas de cromos e quantidades de cada lado, estado, validade e datas das ações.
- **Mensagens:** autor, negociação e data, visíveis apenas aos participantes e ao suporte autorizado.
- **Preferências:** descoberta na comunidade, silêncio de conversas e bloqueios.

Migrar as coleções atuais uma única vez a partir das saquetas existentes, conferindo as quantidades e preservando os vales. Repetir a migração não pode criar exemplares adicionais.

Todas as alterações passam pelo motor de domínio validado e por transações MongoDB. A aceitação transfere os dois conjuntos completos, atualiza reservas e estado, regista os movimentos e cria os avisos na mesma transação. Pedidos repetidos ou aceitações simultâneas não podem duplicar cromos nem executar duas vezes a mesma troca.

As propostas e reservas têm controlo de versão. Duas negociações não podem comprometer o mesmo exemplar disponível. Uma troca concluída nunca se corrige apagando o histórico: qualquer futura reversão exigirá uma operação de compensação auditada.

## 9. Coleção, recompensas e administração

Calcular o progresso e a elegibilidade de recompensas de coleção a partir do inventário real, incluindo os cromos recebidos em trocas. Visitas, limites de saquetas e jogos confirmados continuam a usar as suas fontes atuais. Negociar não gera visitas, jogos, saquetas ou recompensas adicionais da mesma campanha.

Definir uma lista de cromos por época para evitar que novas inscrições ou mudanças de divisão alterem inesperadamente o objetivo de completar a caderneta. Preservar os objetivos históricos dos vales já emitidos e validar os requisitos no pedido e na utilização.

Os administradores podem configurar limites, ativar ou pausar as trocas, consultar movimentos, tratar denúncias e cancelar propostas pendentes. No espaço de jogador, mesmo uma conta administradora apenas coleciona e negoceia como qualquer outra pessoa.

As trocas não alteram resultados oficiais, rankings, estatísticas desportivas ou saldos de moedas.

## 10. Fases de implementação e validação

1. **Base da coleção:** inventário, movimentos, lista de cromos por época, migração e compatibilidade com recompensas.
2. **Motor de negociação:** conjuntos com quantidades, reservas, versões, contrapropostas, aceitação, cancelamento e expiração.
3. **Experiência móvel:** caderneta, repetidos, comunidade, resumo “Dás / Recebes”, conversa privada e histórico.
4. **Notificações e suporte:** abertura direta da negociação, preferências, bloqueios, denúncias e ferramentas de administração.
5. **Piloto local:** contas diferentes, ambos os espaços e trocas 1 por 1, 1 por 2, 1 por 3 e vários por vários.
6. **Revisão antes do lançamento:** apresentar o resultado testado. A publicação só avança quando o utilizador a pedir.

Testar falta de exemplares, proteção da última cópia, várias reservas concorrentes, aceitação de versões antigas, contrapropostas simultâneas, pedidos repetidos, aceitação versus cancelamento/expiração, suspensão de contas, fecho da época, privacidade das conversas, bloqueios, migração repetida, notificações, recompensas e utilização no telemóvel. Executar typecheck, testes e build após alterações substanciais à aplicação.

## Primeiro resultado a demonstrar

Uma negociação local completa: um jogador oferece um repetido, o outro pede uma troca de **1 por 3** por chat e envia a contraproposta com os três cromos concretos. A outra pessoa aceita a versão atual; os quatro exemplares mudam de dono em conjunto, as últimas cópias ficam protegidas, o progresso atualiza e o comprovativo fica disponível para ambos. Repetir o pedido não executa outra transferência.

Este plano substitui a proposta inicial limitada a trocas de um por um. A implementação local foi entretanto autorizada; alterações de produção e publicação continuam dependentes de pedido do utilizador.
