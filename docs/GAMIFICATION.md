# Gamificar — laboratório administrativo

**Estado: Em implementação. Acesso exclusivo ao espaço Admin.** O teste não disponibiliza a funcionalidade a jogadores. “Vale tudo” e “Dominação” estão fora deste desenvolvimento e não têm comandos, botões ou regras novos.

## Como verificar

1. Entrar como administrador e abrir **Admin → Configuração → Gamificação**. Os dois administradores têm o mesmo laboratório e podem escolher jogadores reais da liga, sem criar perfis de teste na competição.
2. Em **Cartas e avatares**, selecionar um jogador. Personalizar alcunha, cabelo, cores, expressão, óculos e barba. Definir os quatro atributos sociais (0–99) e selecionar **Guardar avatar e carta**. Os valores iniciais a zero são apenas uma pré-visualização até serem guardados.
3. Selecionar **Virar carta**. A frente apresenta a foto real e os atributos de padel já guardados; o verso apresenta o avatar ilustrado e os valores lúdicos. Sem atributos de padel guardados aparecem travessões, sem inventar estatísticas. A edição dos atributos de padel continua em **Admin → Cartões e palpites**.
4. **Exportar as duas faces (PNG)** descarrega uma única imagem de 1440 × 1060 com frente e verso. É necessário guardar primeiro. Fotografias locais são incluídas; fotografias externas sem acesso seguro usam iniciais. A exportação identifica a autoavaliação e o teste administrativo.
5. Recarregar a página e voltar a selecionar o jogador para verificar persistência. Os administradores podem editar o mesmo jogador; uma versão antiga não substitui silenciosamente alterações do outro. O rascunho local é mantido em caso de conflito.
6. Abrir **Definições** para editar títulos da frente/verso e nomes dos atributos sociais. Os nomes iniciais são Espírito de bar, Provocação amigável, Bom parceiro e Fair play. Alterar estes textos não modifica as pontuações guardadas. Se os nomes mudarem enquanto se edita um cartão, o editor exige revisão antes de guardar.
7. Abrir **Bar e prémios**: é o mesmo catálogo, configuração e histórico de **Moedas e bar**, não uma segunda carteira. Para testar, ativar o teste privado, configurar recompensas, selecionar uma carteira, registar um crédito manual com motivo e confirmar uma troca presencial. Ver `docs/VIRTUAL-COINS.md` para as regras de ganhos/cancelamentos. Não realizar testes com saldos reais sem intenção de manter os movimentos auditados.
8. A ligação **Abrir caderneta** abre o teste existente de cromos. Os prémios oficiais da liga continuam em **Prémios**.
9. Mudar para o espaço **Jogador**: Gamificação deve desaparecer e as coleções privadas não devem surgir nas respostas da API. Regressar ao espaço Admin para continuar os testes.

## Limites e implementação

O avatar é uma ilustração vetorial original, construída localmente a partir de escolhas; não é uma conversão automática da fotografia nem usa serviços externos de imagens. A carta identifica os atributos como autoavaliação; os sociais são lúdicos, não avaliações verificadas ou votos sobre outras pessoas. Nada muda o ranking, resultados, papéis, prioridades de desafios ou pontos de palpites. Não existe compra de moedas, aposta, transferência ou conversão em dinheiro.

Coleções aditivas `gamificationSettings` e `gamificationProfiles`, índice único por jogador e permissões administrativas no motor de domínio. As gravações usam a transação MongoDB partilhada e incluem versão de perfil/configuração e auditoria antes/depois. Cores usam apenas `#RRGGBB`, escolhas são enumeradas e valores são inteiros de 0–99. Os perfis privados e auditoria são removidos da projeção para jogadores. Perfis com histórico não são eliminados definitivamente; usa-se a remoção existente do jogador.

O estado da ideia **Gamificar** mantém-se **Em implementação** durante os testes dos administradores. Uma futura disponibilização a jogadores exige desenvolvimento e decisão explícitos; não há um botão que a publique automaticamente.

O desenvolvimento decorre em `feature/gamificar`; apenas depois de typecheck, testes, build e verificação de navegador deve ser integrado em `deploy`. O PR executa checks sem publicar; o deploy só é disparado após integração da versão testada.
