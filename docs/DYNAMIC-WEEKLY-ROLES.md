# Papéis dinâmicos por prioridade

Esta alteração está preparada e testada, mas ainda não publicada nem ativada na competição real.

Depois de um deploy autorizado, em **Admin → Regras da competição**:

- Definir **Distância de ataque · Ouro = 2**, **Prata = 2**, **Bronze = 3**.
- Manter **Competição semanal** e **Desafios semanais obrigatórios** ativos.
- Ativar **Ajustar papéis e atribuir emparelhamentos obrigatórios pela prioridade**.

Os valores são configurações independentes por divisão. O título mantém a elegibilidade configurada: alargar a distância da Bronze não permite automaticamente ao 4.º desafiar o campeão. A publicação e abertura dos papéis continuam obrigatórias. Ativar a regra não abre uma divisão que esteja em espera pelo administrador, não recria jogos e não altera os confrontos já atribuídos.

## O que acontece após um desafio

O primeiro desafio válido fica reservado às duas duplas. O algoritmo calcula o máximo de jogos possível com os compromissos protegidos. Se um emparelhamento estiver presente em **todas** as soluções de cobertura máxima, atribui esse adversário automaticamente, sem aceitar/recusar o confronto. Se houver alternativas, mantém a escolha disponível. Os papéis efetivos e avisos pertencem à dupla, incluindo ambos os parceiros.

Em Ouro, **12→10** reserva **11→9**: o 11 só alcança 10 e 9, e o 10 está ocupado. O 9 passa a DEFESA. **4→2** força **3→1**; o 5 fica em DEFESA.

Na Bronze com alcance 3, **9→6**, seguido de **8→5**, deixa o 10 apenas com o 7 e força **10→7**. Já **10→8**, sozinho, deixa várias combinações válidas: não se inventa um confronto obrigatório.

As semanas normais procuram conservar os papéis publicados quando permitem a cobertura máxima. Nas semanas de ataque livre, todas as duplas elegíveis podem iniciar até ficarem comprometidas ou as prioridades exigirem outro papel. O campeão continua a defender e a última dupla a atacar. Os papéis publicados inicialmente ficam preservados; as alterações efetivas têm versão e histórico próprios.

## Limites e controlo do clube

Uma atribuição automática define o adversário, não a data/hora/campo. As duplas combinam o horário ou o admin usa **Marcar e confirmar jogo**. Só então existe o jogo oficial. Não são criados resultados, derrotas ou alterações de ranking pela atribuição, e um papel atribuído não conta como história de jogo concluído.

A prioridade do primeiro desafio válido é preservada mesmo se não for possível completar todos os jogos. O admin recebe um aviso de cobertura parcial. Se outra regra impedir um emparelhamento necessário, o primeiro desafio mantém-se e o conflito é encaminhado para revisão, sem ultrapassar as validações do motor.

Ausências que cubram a semana inteira retiram a dupla das novas opções automáticas. Compromissos já aceites/propostos/marcados/concluídos são protegidos, incluindo adiamentos já autorizados. Pedidos pendentes antigos devem ser resolvidos antes de ativar o modo; não são convertidos ou cancelados silenciosamente. Alterar a distância não reescreve os valores guardados em confrontos anteriores.

## Validação

354 testes, typecheck e build passaram. A simulação automática cobre as escolhas iniciais da Bronze compatíveis com cobertura total, obtendo cinco jogos sem repetir duplas, e os exemplos de prioridade de Ouro/Bronze. O teste de navegador verifica o desafio e o novo papel do segundo parceiro. O teste Mongo executa pedidos simultâneos e confirma que só um ocupa a vaga, incluindo os emparelhamentos derivados.
