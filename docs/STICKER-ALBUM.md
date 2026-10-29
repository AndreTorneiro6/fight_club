# Caderneta do clube — teste privado

Disponível apenas no espaço **Administrador → Caderneta**. Os dois administradores podem colecionar separadamente com as suas contas. Entrar no espaço Jogador remove este acesso; nenhuma configuração permite publicar a funcionalidade para jogadores nesta versão.

## Começar

1. Ter uma época ativa e um perfil aprovado associado à conta de administrador.
2. Abrir Caderneta, guardar a configuração e ativar o teste.
3. Abrir a saqueta com o botão ou a interação de abanar suportada pelo dispositivo. Ambos usam a mesma ação no servidor.
4. Consultar os cromos dos jogadores da liga, incluindo repetidos, progresso e vales ganhos. Cada administrador tem a sua coleção.

Por defeito: teste desligado, uma saqueta gratuita por dia e três cromos por saqueta. Os limites configuráveis são 1–5 saquetas/dia e 1–10 cromos/saqueta. A mudança do dia segue Europe/Lisbon, incluindo horário de verão. A seleção usa aleatoriedade criptográfica uniforme no servidor; repetidos são possíveis. Não há compras, trocas, probabilidades pagas ou influência sobre ranking, cartões pessoais, palpites ou jogos.

## Prémios de fidelização

Os prémios começam desligados. Um administrador pode definir uma descrição (por exemplo, água no clube), o objetivo e a métrica:

- Dias distintos em que abriu uma saqueta nesta época; este contador não prova presença física no clube.
- Jogos realmente concluídos com resultado confirmado nesta época, com participação registada nos históricos das equipas; faltas de comparência, recusas, cancelamentos e resultados automáticos não contam. Jogos confirmados sem detalhe de sets continuam válidos.
- Percentagem de jogadores diferentes colecionados, até 100%.

Atingir o objetivo permite reclamar um vale com código privado. Não é uma reserva nem uma entrega automática de um produto. Os vales anteriores continuam visíveis ao alterar a campanha. Mesmo sem uma época ativa, os administradores podem validar vales já emitidos. O outro administrador pode confirmar o código e marcar o vale como utilizado. A utilização só ocorre uma vez, com controlo de versão e auditoria. Correções dos jogos/saquetas que retirem o direito ao prémio bloqueiam a utilização e mostram a razão.

Mudar o nome, métrica ou objetivo cria uma nova campanha. Vales já reclamados mantêm o prémio e objetivo originais. A percentagem de um vale de coleção usa os jogadores existentes quando foi reclamado; novas inscrições não retiram esse direito.

## Persistência e privacidade

Coleções adicionais: `stickerSettings`, `stickerPacks` e `stickerRewards`. Todas as ações passam pelo motor validado e pela transação MongoDB existente. Configuração versionada, pedidos de saquetas idempotentes, limites diários transacionais e chaves únicas impedem duplicações por cliques/repetição de pedidos. A vista inclui apenas as saquetas e coleção da própria conta. Administradores podem consultar os vales para os validar no clube. Contactos pessoais não fazem parte do catálogo.

Comandos: `admin.stickers.settings`, `admin.stickers.open`, `admin.stickers.claim` e `admin.stickers.redeem`. Todas as ações e leituras verificam o papel efetivo de administrador antes de processar dados. As coleções são retiradas das vistas dos jogadores. Não existem notificações aos jogadores nem ativação automática de campanhas.

Testes de domínio: `npx tsx --test tests/sticker-album.test.ts`. Cobrem permissões, calendário de Lisboa/DST, saquetas idempotentes e limites, isolamento das coleções, elegibilidade do catálogo, versões, campanhas, vales, correções e participação histórica em jogos.

## Layout dos cromos — 29 outubro 2026

A caderneta usa os modelos originais Ouro/Prata/Bronze fornecidos, partilhados com o cartão pessoal e a prévia administrativa. Os cromos podem ser ampliados para leitura no telemóvel. O rating e os seis atributos vêm apenas de autoavaliações guardadas; valores ainda não definidos aparecem como travessões. Os cromos por colecionar mantêm fotografia/atributos ocultos. Esta mudança não ativa o plano de trocas nem altera as saquetas, os vales ou a restrição a administradores. Ver [layout e proveniência](CROMOS_LAYOUT.md).
