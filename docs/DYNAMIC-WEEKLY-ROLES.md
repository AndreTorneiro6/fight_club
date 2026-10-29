# Papéis dinâmicos por prioridade

Verificado em 29/10/2026: modo dinâmico ativo em **Ouro, Prata e Bronze**, com alcance **3 em cada divisão**. O valor global continua 2, mas os três valores específicos por divisão têm precedência. A elegibilidade do título continua limitada pela configuração própria (`titleMaxPosition=3`).

Em **Admin → Regras da competição**, a distância de cada divisão guarda imediatamente. O motor usa sempre a distância configurada para essa divisão, recalcula os papéis efetivos da semana publicada e atualiza os rascunhos gerados. O plano em cache é invalidado quando mudam a distância, as posições ou os compromissos. Não é necessário alterar o algoritmo quando o alcance muda.

A publicação e abertura dos papéis continuam obrigatórias. Alterar o alcance não abre uma divisão em espera, não recria jogos nem altera os confrontos já atribuídos.

## O que acontece após um desafio

O primeiro desafio válido fica reservado às duas duplas. O algoritmo calcula o máximo de jogos possível com os compromissos protegidos. Se um emparelhamento estiver presente em **todas** as soluções de cobertura máxima, atribui esse adversário automaticamente, sem aceitar/recusar o confronto. Se houver alternativas, mantém a escolha disponível. Os papéis efetivos e avisos pertencem à dupla, incluindo ambos os parceiros.

Os exemplos históricos de Ouro com alcance **2** — **12→10** força **11→9**, ou **4→2** força **3→1** — não devem ser aplicados automaticamente ao alcance **3**. Com alcance 3 há outras alternativas; só os emparelhamentos comuns a todas as soluções de cobertura máxima são obrigatórios.

Na Bronze com alcance 3, **9→6**, seguido de **8→5**, deixa o 10 apenas com o 7 e força **10→7**. Já **10→8**, sozinho, deixa várias combinações válidas: não se inventa um confronto obrigatório.

As semanas normais procuram conservar os papéis publicados quando permitem a cobertura máxima. Nas semanas de ataque livre, todas as duplas elegíveis podem iniciar até ficarem comprometidas ou as prioridades exigirem outro papel. O campeão continua a defender e a última dupla a atacar. Os papéis publicados inicialmente ficam preservados; as alterações efetivas têm versão e histórico próprios.

## Limites e controlo do clube

Uma atribuição automática define o adversário, não a data/hora/campo. As duplas combinam o horário ou o admin usa **Marcar e confirmar jogo**. Só então existe o jogo oficial. Não são criados resultados, derrotas ou alterações de ranking pela atribuição, e um papel atribuído não conta como história de jogo concluído.

A prioridade do primeiro desafio válido é preservada mesmo se não for possível completar todos os jogos. O admin recebe um aviso de cobertura parcial. Se outra regra impedir um emparelhamento necessário, o primeiro desafio mantém-se e o conflito é encaminhado para revisão, sem ultrapassar as validações do motor.

Ausências que cubram a semana inteira retiram a dupla das novas opções automáticas. Compromissos já aceites/propostos/marcados/concluídos são protegidos, incluindo adiamentos já autorizados. Pedidos pendentes antigos devem ser resolvidos antes de ativar o modo; não são convertidos ou cancelados silenciosamente. Alterar a distância não reescreve os valores guardados em confrontos anteriores.

## Validação

A simulação automática cobre todas as escolhas iniciais compatíveis com cobertura total: cinco jogos na Bronze de dez duplas e seis jogos em Ouro/Prata de doze duplas, com alcance 3 e sem repetir duplas. Testes adicionais aumentam a distância de 2 para 3 através do comando administrativo, verificando novas opções, invalidação de cache e preservação dos jogos comprometidos. Os exemplos históricos com alcance 2 continuam testados como configuração alternativa. O teste de navegador verifica o desafio e o novo papel do segundo parceiro. O teste Mongo executa pedidos simultâneos e confirma que só um ocupa a vaga, incluindo os emparelhamentos derivados.

## Contagem decrescente por divisão

Em Admin → Papéis semanais → Intervalo entre os papéis e a abertura, escolher divisão e minutos. Num rascunho, guardar o intervalo antes de aprovar: a contagem começa apenas na publicação administrativa. Se os papéis já estão publicados, **Ativar contagem desta divisão** começa o intervalo nesse momento. Sem ativação, a Bronze mantém a espera pelo administrador. Também é possível indicar dia/hora exatos no formulário existente.

Admin e jogadores veem o mesmo prazo em hora de Portugal, atualizado a cada segundo. A autorização permanece no servidor, e o aviso de abertura existente é enviado uma única vez quando chega a hora. Esta funcionalidade serve Ouro e Prata nas próximas jornadas, sem alterar os jogos atuais. Não existe intervalo universal imposto: cada administrador escolhe o valor.

O papel efetivo final, guardado separadamente do papel inicial, é usado como preferência de rotação na preparação da próxima semana. Continua a ser uma preferência sujeita às regras de ranking e cobertura.
