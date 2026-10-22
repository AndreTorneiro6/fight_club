# Patrocínios

**Admin → Configuração → Patrocínios** gere os patrocinadores da liga. A página **A liga → Patrocínios** (`/patrocinios`) é de leitura para jogadores e administradores.

## Criar e publicar

Selecionar Novo patrocinador, preencher o nome e os detalhes e guardar. São editáveis: nome, descrição, website HTTPS, URL HTTPS do logótipo, etiqueta do apoio, ordem de apresentação e publicação. Na ausência de imagem ou em caso de falha no carregamento, aparecem as iniciais. Os endereços não podem conter credenciais. Os links externos abrem noutra janela.

Um novo registo começa privado. Marcar **Publicado para jogadores** e guardar torna-o visível na página da liga. Desmarcar retira-o da página e das referências apresentadas aos jogadores, mantendo o registo, os prémios associados e a auditoria. Não existe eliminação definitiva que possa quebrar associações.

Os valores de ordem mais baixos aparecem primeiro; empates são resolvidos por nome e identificador. O catálogo começa vazio, sem patrocinadores fictícios.

## Associar prémios

Em **Prémios → Editar prémios**, selecionar **Patrocinador do prémio** para cada oferta e publicar as alterações. Um prémio pode não ter patrocinador. A administração pode associar um patrocinador privado antes do anúncio; o nome e a referência ficam ocultos aos jogadores enquanto não for publicado.

Os prémios mostram uma ligação ao patrocinador publicado. O cartão do patrocinador mostra os prémios que apoia, com ligação à página de prémios. As associações usam identificadores estáveis: renomear ou reordenar um patrocinador não as altera. Retirar um prémio da lista desfaz essa associação sem eliminar o patrocinador.

## Permissões e histórico

Coleção aditiva `sponsors`, com índice de publicação/ordem. Guardar exige o espaço Admin efetivo e passa pelo motor de domínio e pela transação MongoDB existente. `expectedVersion` bloqueia sobrescritas por outro administrador, mantém o rascunho local e permite carregar explicitamente a versão atual. As edições ficam no histórico privado de auditoria.

O editor de regulamento/prémios captura `contentVersion` para detetar alterações concorrentes; alterações às regras gerais não apagam este contador nem as associações a patrocinadores. Os comandos antigos sem o contador continuam compatíveis.

O backend filtra patrocinadores privados e referências a esses registos antes de responder a jogadores, incluindo contas administrativas no espaço Jogador. Não são alterados rankings, jogos, moedas ou resultados. Coleções antigas não são apagadas nem reescritas.
