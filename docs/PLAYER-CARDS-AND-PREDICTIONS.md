# Cartões pessoais e palpites

## Cartão pessoal

Em **Cartões**, o jogador pode avaliar seis atributos de padel: velocidade, smash, lob, voleio, defesa e físico. Cada atributo aceita um número inteiro entre 0 e 99. O geral (Overall) pode ser escolhido entre 0 e 99, independentemente dos seis atributos. Se ainda não existir um geral definido, apresenta-se a média simples dos seis valores, arredondada ao inteiro mais próximo.

Os valores iniciais de 50 são apenas uma pré-visualização: não existe autoavaliação guardada até o jogador selecionar **Guardar atributos**. A aplicação identifica o cartão e a imagem exportada como **autoavaliação**. Estes valores não alteram resultados, rankings, papéis ou prioridades. Os cartões de competição apresentados abaixo continuam a usar exclusivamente resultados oficialmente validados.

No espaço de jogador, cada pessoa só pode alterar o próprio cartão. No espaço de administração, o administrador pode selecionar qualquer jogador elegível e alterar os seus atributos e geral. A identidade do administrador e a origem da alteração ficam registadas na auditoria. A aplicação valida a associação entre utilizador e jogador no servidor. O comando transacional `player.attributes.save` exige a versão anterior; uma sessão desatualizada não pode substituir silenciosamente os valores guardados noutra sessão. Cada alteração fica registada na auditoria.

Após guardar, **Partilhar cartão pessoal** cria uma imagem PNG. A partilha nativa do dispositivo é usada quando disponível; caso contrário, a imagem é descarregada. O cartão visual tem um tema associado à liga e uma identidade original Fight Club.

As conquistas de participação e vitórias usam jogos com resultado oficialmente validado. A criação do perfil é uma conquista de preenchimento, identificada separadamente dos feitos em campo.

## Palpites dos jogos

O separador **Palpites dos jogos** permite escolher a equipa vencedora e o resultado em sets (2–0 ou 2–1). Cada utilizador autenticado pode guardar um palpite por jogo oficialmente publicado. A equipa adversária é implicitamente a perdedora; não é necessário um segundo palpite.

Os palpites fecham antes do início do jogo, segundo o horário e as definições existentes. Um adiamento não reabre um palpite cujo prazo já terminou. Sem horário confirmado não é possível submeter palpites. Só os resultados oficialmente validados atribuem pontos.

A classificação é independente da competição. Por defeito, acertar no vencedor vale 3 pontos e acertar também nos sets acrescenta 2 pontos. As regras podem ser configuradas pelo administrador. A participação é gratuita e não envolve dinheiro.

## Migração e dados

A coleção adicional `playerAttributes` é opcional no estado legado e começa vazia. Um índice único por `playerId` impede perfis duplicados. Nenhum cartão ou palpite exige converter resultados antigos, inventar estatísticas ou publicar jogos que ainda são propostas privadas.

Os cartões antigos são normalizados apenas na leitura: ataque → smash, controlo → lob, técnica → voleio e resistência → físico. Os documentos históricos não são apagados ou reescritos para esta adaptação.
