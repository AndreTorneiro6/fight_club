# Caderneta e trocas de cromos

Implementação local do [plano acordado](CROMOS_EXCHANGE_PLAN.md), preparada para revisão antes do lançamento. A publicação e a ativação para jogadores continuam pendentes de pedido do utilizador. Os modelos originais dos cromos são preservados; ver [proveniência do layout](CROMOS_LAYOUT.md).

## Acesso e configuração

A entrada **Caderneta** tem cinco áreas: A minha caderneta, Repetidos, Comunidade, Negociações e Histórico. A entrada destacada mostra saquetas disponíveis e propostas para responder. As notificações abrem a negociação ou mensagem correspondente.

Por defeito, `communityEnabled` e `tradesEnabled` são falsos. A prévia administrativa existente continua disponível. Em Administrador → Caderneta, a configuração versionada permite ativar separadamente saquetas, comunidade e trocas, definir limites (10 exemplares por lado, 5 negociações iniciadas pendentes, 72 horas por versão) e configurar recompensas. Desligar trocas impede novas propostas, contrapropostas e aceitações; permite consultar o histórico, conversar e cancelar. Não existe ativação automática numa atualização.

Uma conta tem um inventário por época, partilhado entre espaços. Espetadores aprovados e ativos podem colecionar e trocar; não originam um cromo próprio no catálogo. Descoberta e novas propostas exigem adesão individual. Pausar propostas retira a pessoa da descoberta sem terminar negociações existentes.

## Frente e verso dos cromos

Cada cromo obtido tem a opção **Ver verso**; a ampliação permite alternar **Frente / Verso**. A frente conserva o modelo original Ouro/Prata/Bronze. O verso reutiliza o desenho já existente das cartas, com cartoon da fotografia, slogan, assinatura, apelido e autoavaliação fora de campo. Campos por preencher não inventam pontuações; um zero guardado continua a ser zero. Cromos em falta não revelam o verso.

Nesta publicação privada, os dados sociais do verso e a geração de cartoons mantêm acesso exclusivo de administrador. A projeção inclui apenas os campos de apresentação, sem autores, versões ou datas do perfil. Não são alargadas as permissões do endpoint de cartoons.

## Negociar

Escolher um parceiro na comunidade, indicar os cromos e quantidades em **Dás / Recebes** e enviar. São permitidas quantidades diferentes: 1 por 1, 1 por 2, 1 por 3 e vários por vários. A comunidade revela apenas repetidos disponíveis e oportunidades, sem contactos, inventários completos ou recompensas alheias.

Só o autor da versão atual reserva os seus exemplares. Uma contraproposta troca essa reserva numa única transação e substitui a versão anterior. Apenas o outro participante pode aceitar a versão atual, no botão junto aos termos exatos. Uma mensagem nunca aceita uma troca nem prolonga a validade.

A aceitação verifica contas, época, versão e disponibilidade dos dois lados; transfere todos os exemplares de uma vez e preserva sempre a última cópia. Um pedido repetido devolve o comprovativo sem nova transferência. Uma proposta indisponível é invalidada e liberta a reserva. Recusa, cancelamento, expiração, bloqueio, suspensão e encerramento da época também libertam reservas.

Conversas são privadas, com páginas de 100 mensagens e ligações para mensagens antigas. Terminar a negociação torna a conversa só de leitura. É possível silenciar, bloquear e denunciar. Notificações de cromos são **push/in-app**, genéricas e agrupadas para mensagens próximas; não enviam email ou WhatsApp.

## Inventário, catálogo e recompensas

O catálogo fica fixo por época: inscrições posteriores e mudanças de divisão não alteram o objetivo. A migração parte das saquetas históricas, conserva-as e usa movimentos determinísticos para não duplicar exemplares quando repetida. Transferências têm movimentos imutáveis de entrada e saída e comprovativo com versão e referências.

Progresso e prémios de coleção usam o inventário, incluindo cromos recebidos. Dias de saquetas e jogos confirmados mantêm as fontes anteriores; trocar não gera visitas, jogos, moedas ou resultados desportivos. Vales emitidos mantêm os seus objetivos e são revalidados na utilização. Administradores validam e utilizam códigos uma única vez, com versão e auditoria.

O Histórico mostra todas as negociações e os 200 movimentos mais recentes da própria coleção. O suporte dispõe de consulta paginada do registo completo por conta, cancelamento de propostas com motivo e tratamento de denúncias. Administradores só consultam mensagens de terceiros através de uma denúncia, com cada consulta registada. A vista geral da liga nunca inclui inventários, propostas ou conversas privadas, mesmo para administradores.

Coleções: `stickerSettings`, `stickerPacks`, `stickerRewards`, `stickerCatalogs`, `stickerInventories`, `stickerMovements`, `stickerMigrations`, `stickerTrades`, `stickerTradeMessages`, `stickerPreferences`, `stickerReports`. Alterações passam pelo motor validado e pela transação MongoDB existente; índices únicos, controlo de versão e pedidos idempotentes protegem reservas e transferências.

## Verificação local

- `npm run typecheck`, `npm test`, `npm run build`.
- `tests/sticker-trading.test.ts`: migração, catálogo, quantidades, reservas, versões, recompensas, privacidade, denúncias, bloqueios, expiração e links para mensagens antigas.
- `tests/sticker-trading-database.test.ts`: transações MongoDB reais com aceitações, cancelamento, contrapropostas e reservas concorrentes.
- `TMPDIR=/var/tmp DEMO_TEST_STICKER_TRADING=1 npx playwright test e2e/sticker-trading.spec.ts`: piloto descartável com contas diferentes, troca 1 por 3 no telemóvel, atualização em direto, comprovativo, repetição, partilha de inventário entre espaços e espetador sem cromo.
- Sem a variável do piloto, `e2e/sticker-album.spec.ts`, `personal-cromo.spec.ts` e `gamification.spec.ts` verificam compatibilidade da prévia, vales e modelos originais.

O cenário do piloto só é criado por `scripts/demo.ts --test`; não acrescenta endpoints ou permissões especiais à aplicação.
