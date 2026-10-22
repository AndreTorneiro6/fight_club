# Bloco de ideias

Admin → Ideias é um bloco de notas privado, partilhado entre os administradores. Cada ideia tem um título e texto livre, pesquisa, pré-visualização, data de atualização e versão. O texto é apresentado como texto simples: HTML e scripts nunca são executados.

Guardar é explícito. Alterações locais não são substituídas por atualizações em tempo real de outro administrador. Se duas pessoas editarem a mesma versão, apenas a primeira gravação é aceite; a segunda recebe um conflito e mantém o texto local. Pode guardar uma nova ideia ou carregar a versão atual. Fechar a página com alterações por guardar mostra o aviso normal do navegador.

Arquivar retira uma ideia da lista ativa sem apagar o seu conteúdo. A opção Ver arquivadas permite restaurá-la. As versões anteriores são preservadas no registo privado de auditoria. Não existe eliminação definitiva de notas.

## Persistência e acesso

A coleção opcional `adminNotes` é aditiva e começa vazia, sem alterar dados de competição. Os comandos `admin.notes.save` e `admin.notes.archive` passam pelo motor validado e pela transação MongoDB existente. Cada edição inclui `expectedVersion`; conflitos devolvem HTTP409. Criação e edição exigem uma identidade administrativa efetiva, não apenas uma conta que tenha esse papel disponível.

As notas e os respetivos registos de auditoria não podem ser enviados a jogadores, incluindo administradores que estejam no espaço Jogador. Não afetam rankings, resultados, palpites, notificações a jogadores nem emparelhamentos.
