## Política atual — email apenas para conta (27 outubro 2026)

Por instrução explícita do administrador, convites, verificação de endereço e recuperação de palavra-passe continuam por email. Notificações da liga, apostas, resultados, chat e avisos gerais usam a aplicação/push. A política leagueEmailsEnabled é false por defeito e pode ser configurada por administrador; preferências individuais são preservadas. A fila não deve enviar emails antigos enquanto a política estiver desativada. Não reenviar falhas antigas automaticamente.

Avisos de apuramento só após submissão/correção efetiva de sets oficiais para o jogo em causa. Não fazer apuramento retroativo ao arrancar/deploy ou fechar apostas. A publicação1.9.1 aplica esta política; confirmar estado live no handoff.

A consulta de uso do Resend de27 outubro indicou200/100 envios diários e200/3000 mensais, renovação às00:00UTC de28 outubro. Foram observadas recusas550; a quota pode afetar também emails de conta até renovar. Não foi comprado plano pago.

# Email da aplicação — migração para Resend

## Verificação concluída — 27 outubro 2026

Domínio e quatro registos verificados. Chave dedicada apenas de envio, restrita a wbglabs.io, guardada em .env.resend.local (0600). email:verify autenticou por TLS. Um único email:test para atorneiro507@gmail.com foi entregue segundo Resend (ID 01a17e27-da9f-7f03-83e5-6c0549d166fc, 16:18:23 UTC). Falta confirmar pasta de chegada/cabeçalhos Gmail antes da migração de produção, ainda não realizada. Este estado substitui as indicações anteriores de DNS/chave/teste pendentes abaixo.

## Decisão e estado atual

Em27 de outubro de2026, o utilizador escolheu **Resend**, mantendo `wbglabs.io` no plano Domain only da one.com. Não é necessário comprar uma caixa de email na one.com para enviar com um domínio verificado na Resend.

Remetente pretendido: `Fight Club Padel League <no-reply@wbglabs.io>`.

O código está preparado localmente. Produção continua operacional no remetente antigo `no-reply@atlasapp.pt` via `send.one.com:587`. Não trocar para Resend antes de verificar o domínio, autenticar e analisar um teste recebido. Não alterar MX de receção, contas dos jogadores ou `ADMIN_EMAIL`.

## Ligação OAuth ativa e domínio criado — 27 outubro 2026

MCP Resend acessível por OAuth. Criado `wbglabs.io`, ID `a3f0c8f2-f430-4808-8f03-a653338f9883`, região `eu-west-1`, apenas envio, tracking de aberturas/cliques desligado. Estado inicial `not_started`. Nenhuma chave criada e nenhum teste enviado. Conta: 100 emails/dia, 3000/mês; utilização zero na consulta.

Registos exatos devolvidos pelo fornecedor (TTL Auto):

| Tipo | Nome na one.com | Valor | Prioridade |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCyUvuto5ttoeGbo84paKFjieZV3Ebmp7+67bNSrIRE4WXC3Mb9YGEl7Aa9iU0nGukrQgPsSBoTRk63nSELCBI0L9e/q+xlvUgA43Bg43hrGan7X+9snK39c7GaHIRgKMShlmo+yfU/idCdjeqyae+kuNIJhZ2zRYykyZPTC6HgYQIDAQAB` | — |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend` | `send.forge.rmta.net` | — |

Consulta DNS pública ainda sem estes registos. Sem ferramenta de acesso DNS one.com disponível: adicionar manualmente e depois verificar via MCP. Preservar MX/SPF do domínio raiz e DMARC. Antes de qualquer escrita DNS pelo agente, apresentar os registos e obter a aprovação prevista no guia oficial `https://resend.com/setup.md`.

## Passos no painel Resend

1. Criar/iniciar sessão numa conta Resend.
2. Em **Domains**, adicionar exatamente `wbglabs.io`, para manter o remetente pedido. Escolher uma região europeia, se disponível na conta. Configurar apenas envio; não ativar receção nem tracking de aberturas/cliques para estes emails transacionais.
3. Copiar os registos DNS apresentados pela Resend: tipo, nome, valor e prioridade, quando aplicável.
4. Na one.com, abrir as definições DNS de `wbglabs.io` e adicionar apenas esses registos. Usar os valores efetivos da conta, nunca chaves/seletores inventados.
5. Aguardar propagação e usar a verificação de domínio da Resend até o envio ficar verificado.
6. Em **API Keys**, criar uma chave dedicada à aplicação, com permissão de envio e restrição a `wbglabs.io` quando disponível. Guardá-la apenas na configuração privada.

Não substituir os MX do domínio raiz para configurar o envio. Se a Resend pedir um MX para o subdomínio de retorno, esse registo pertence apenas ao nome indicado. Não criar dois SPF no mesmo nome nem enfraquecer o DMARC existente. O SPF de envio poderá estar num subdomínio diferente do SPF do domínio raiz; seguir os registos realmente apresentados pelo fornecedor.

## Configuração privada preparada

O ficheiro `.env.resend.local` está ignorado pelo Git, com permissões0600:

```dotenv
SMTP_URL=smtps://smtp.resend.com:465
SMTP_USER=resend
SMTP_PASSWORD="API_KEY_DE_ENVIO_DA_RESEND"
EMAIL_FROM="Fight Club Padel League <no-reply@wbglabs.io>"
```

`SMTP_PASSWORD` contém a API key da Resend. Não é a palavra-passe de uma caixa de correio. O antigo ficheiro `.env.mail.local`, preparado para one.com, deixou de ser usado pelos comandos de verificação/teste; foi preservado e não é carregado automaticamente pela aplicação.

A configuração usa SMTP, sem nova dependência ou SDK. `lib/mail.ts` é comum a convites, confirmação de email, recuperação de acesso e notificações. Continua compatível com o envio antigo para permitir migração controlada e recuperação. Exige TLS remoto com certificado válido, tempos limite de10 segundos e desativa debug. Apenas SMTP em loopback pode funcionar sem TLS, para testes locais.

## Verificação e único teste real autorizado

```sh
npm run email:verify
npm run email:test
```

- `email:verify` autentica sem enviar mensagens. Confirma o servidor Resend, utilizador `resend` e remetente `no-reply@wbglabs.io`. Autenticação SMTP não prova que o domínio já permite enviar; confirmar também o painel e o teste real.
- `email:test` envia uma mensagem de diagnóstico apenas para **atorneiro507@gmail.com**, sem CC/BCC ou destinatários configuráveis. Não cria contas, tokens ou notificações na liga.
- Não enviar outros testes reais automaticamente nem voltar a usar o destinatário anterior.

Antes da mudança de destinatário, o utilizador autorizou `andre.torneiro12@gmail.com` e um teste do remetente antigo foi aceite para esse endereço. Depois pediu `atorneiro507@gmail.com`; foi aceite um único teste de referência do remetente antigo para esse endereço, Message-ID `<04993a63-0e41-4bfd-5878-d72bfcd33286@atlasapp.pt>`. Ainda não foi enviado qualquer teste real pela Resend.

## Diagnosticar spam e autenticação

No Gmail: abrir a mensagem → menu de três pontos → **Mostrar original**. Consultar SPF, DKIM e DMARC em `Authentication-Results`, o domínio/seletor de `DKIM-Signature` e o `Return-Path`.

No novo envio, verificar `dkim=pass` com domínio alinhado com `wbglabs.io`, autenticação SPF do remetente técnico e `dmarc=pass` para o From. O Return-Path pode usar um subdomínio de retorno do fornecedor; não precisa de ser igual ao endereço visível. Aceitação SMTP não confirma entrega na caixa de entrada.

Se continuar em spam apesar de autenticação correta, analisar conteúdo, frequência e reputação com os eventos da Resend e os cabeçalhos recebidos. Não prometer resolução do spam apenas por trocar de fornecedor. Testes noutros serviços, como Outlook, exigem um destinatário adicional autorizado pelo utilizador.

## Limites e ativação

O plano gratuito anunciado pela Resend permite3.000 emails/mês e100 por dia; confirmar os limites efetivos no painel antes de ativar. A frequência das notificações de jogos/chat pode consumir rapidamente essa quota. A escolha de Resend não autoriza automaticamente um plano pago ou alterações às preferências de email dos jogadores.

Depois de validar domínio e teste:

1. Preservar configuração anterior numa cópia privada.
2. Atualizar apenas as variáveis de email no servidor, sem copiar outros segredos locais ou repor a fila.
3. Aplicar o código validado e recriar app/worker com a mesma configuração.
4. Verificar saúde, ligação SMTP e novo remetente sem imprimir a chave.
5. Acompanhar eventos, rejeições e quotas no painel. Não repetir entregas antigas nem assumir que uma falha permanente deve ser reenviada sem revisão.

Os erros da aplicação guardam códigos SMTP seguros e distinguem rejeições temporárias/permanentes, sem expor credenciais ou respostas privadas do fornecedor.

## DNS e diagnóstico anterior

Últimas verificações públicas: `wbglabs.io` usa `ns01.one.com`/`ns02.one.com`, tem SPF `v=spf1 include:_custspf.one.com ~all`, DMARC `p=reject` e MX de receção one.com. Não foram alterados estes registos. O SPF de `atlasapp.pt` já inclui Google e one.com; o diagnóstico de SPF em falta de19 de outubro está ultrapassado. Autenticação e STARTTLS do envio antigo foram verificados com sucesso.

## Testes locais

Os testes usam SMTP de loopback e MongoDB isolado; não entregam mensagens na Internet. Cobrem os quatro fluxos, Message-ID/remetente, credenciais antigas e Resend, TLS, verificação sem envio, destinatários e privacidade/repetição de falhas. Executar typecheck, testes e build após alterações.

## Referências

- SMTP Resend: https://resend.com/docs/send-with-smtp
- Verificação de domínios: https://resend.com/docs/dashboard/domains/introduction
- Gestão de API keys: https://resend.com/docs/dashboard/api-keys/introduction
- Limites e preços: https://resend.com/pricing
- Requisitos Gmail: https://support.google.com/mail/answer/81126
- Transporte SMTP Nodemailer: https://nodemailer.com/smtp
