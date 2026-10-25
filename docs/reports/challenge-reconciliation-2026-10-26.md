# Simulação — reconciliação dos desafios por dupla

**APENAS SIMULAÇÃO. Não publicado nem aplicado; zero notificações reais enviadas.**

Leitura de produção: 25/10/2026 01:12:38 WEST. Época `season-1`; semana dos jogos `2026-10-26`; todas as divisões.

Resultado: **8 mantidos, 5 cancelamentos propostos, 0 conflitos protegidos**. Um pedido anteriormente cancelado (#4) permanece encerrado.

## Desafios conservados

| Desafio | Ataque | Defesa | Estado preservado |
|---|---|---|---|
| #1 | Andre Torneiro + Ruizinho | Tiago Torres + Pedro Silva | accepted |
| #2 | Ivo Tavares + Rui Dias | Hélder Marques + Mário Ferreira | pending |
| #3 | Jérémy Rocha + Claudio Silva | Tiago Marques + Alberto Vale | pending |
| #5 | Raul de sa machado + Ivo Amorim | Nuno Dias + Gonçalo Costa | pending |
| #7 | Raul Tavares + Paulo Santos | Diogo Faria + Nuno Rodrigues | pending |
| #8 | Luís Brito + Bruno Fonte | Andre Machado + Alexandre Silva | pending |
| #10 | Joel Silva + Johnny Gonçalves | Diogo Seromenho + Diogo Dantas | pending |
| #12 | José Gil + Andre Gil | Miguel Soares + Miguel Dias | schedule_pending |

## Cancelamentos propostos

A conservação do primeiro envio abrange ataque/defesa e pedidos em fila. A regra normal de fila não é alterada permanentemente.

| Cancelar | Ataque | Defesa | Primeiro envio conservado |
|---|---|---|---|
| #6 | João Passos | Ivo Tavares + Rui Dias | #2 |
| #9 | Diogo Faria + Nuno Rodrigues | Tiago Figueiredo + Tiago Carreira | #7 |
| #11 | Diogo Seromenho + Diogo Dantas | João Parente + Luís Gonçalves | #10 |
| #13 | Flávio Simões + Bruno Torres | Diogo Seromenho + Diogo Dantas | #10 |
| #14 | João Parente + Luís Gonçalves | Jérémy Rocha + Claudio Silva | #3 |

## Aviso preparado

**66 jogadores ativos**, um aviso personalizado para cada um, mais um resumo administrativo. Canais: app/push. Nenhum envio realizado.

**Título:** Revê os desafios da tua dupla

> A competição funciona por dupla, não por jogador. Uma falha na identificação dos parceiros permitiu desafios incompatíveis. Nesta correção mantém-se o primeiro envio válido por dupla e cancelam-se os pedidos posteriores incompatíveis, sem derrota nem alteração do ranking. Ambos os parceiros podem consultar e gerir o mesmo desafio. Abre Desafios e volta a confirmar o estado da tua dupla.

Cada aviso acrescenta os números dos desafios conservados/cancelados desse jogador, se existirem. O #1 de Andre Torneiro + Ruizinho permanece aceite. O #12 mantém o horário em confirmação.

## Validação da operação em memória

- Aplicação simulada: 5 pedidos passam a cancelados; 8 mantidos.
- Avisos preparados em memória: 66 de jogador + 1 administrativo.
- Ranking, resultados, jogos e histórico competitivo permanecem iguais. Os registos cancelados e as disponibilidades/mensagens não são apagados.
- 310 testes, typecheck e build passaram, incluindo concorrência real com réplica MongoDB.

**Antes de executar:** gerar um novo plano a partir dos dados atuais e rever a impressão digital. Este relatório não autoriza publicação, cancelamentos ou envio dos avisos.
