# Pesquisa global e utilização no iPhone

## Pesquisa

A barra **Pesquisar na app…** está disponível nas páginas autenticadas após escolher o espaço de trabalho. Clicar na barra ou usar **Ctrl+K / Cmd+K** abre a pesquisa. Escrever um termo, navegar com ↑/↓ e abrir com Enter; Esc ou Fechar pesquisa fecha e devolve o foco. Também é possível tocar diretamente num resultado.

A pesquisa ignora acentos e distingue o espaço efetivo:

- Admin: secções do painel (Ideias, Gamificação, Moedas e bar, Patrocínios, etc.), páginas da liga, jogadores na gestão e jogos.
- Jogador: páginas a que tem acesso, os próprios jogos/equipa e patrocinadores publicados. Não aparecem secções administrativas, dados privados de gamificação, notas ou emparelhamentos por publicar.

As secções administrativas abrem diretamente através de `/admin?tab=...`. Um resultado de jogador abre a gestão filtrada pelo nome e estado da inscrição, sem alterar dados ou abrir uma edição automaticamente. Nenhum email, corpo de nota ou registo de auditoria é indexado. O índice usa exclusivamente o estado autorizado já recebido pela app, sem um novo serviço externo.

## Carta de duas faces

Em Admin → Gamificação, a **Frente · Fotografia do perfil** usa a fotografia real guardada no perfil desse jogador. Não existe uma fotografia separada na carta. O **Verso · Cartoon** usa o avatar ilustrado personalizável. Os atributos sociais iniciais são Bebida (drinking), Trash talk, Bom parceiro e Fair play; nomes e valores continuam editáveis. Definições já personalizadas são preservadas. A gamificação mantém-se privada e Em implementação.

## iPhone

O layout respeita as áreas reservadas ao relógio, bateria, recortes laterais e indicador inferior. A configuração de novas instalações usa uma barra de estado opaca; o espaçamento CSS também protege instalações antigas com barra translúcida. O cabeçalho, janelas, pesquisa, avisos e botão de temas usam os insets; o conteúdo tem espaço para o menu inferior.

A app acompanha o visual viewport para ajustar a altura das janelas quando o teclado abre. Em ecrãs móveis, botões têm altura mínima de 44px, botões de ícone têm largura mínima de 44px e os campos usam 16px para evitar zoom automático ao escrever. O zoom manual continua permitido.

Depois da atualização, fechar e reabrir a app instalada no iPhone. Verificar login, botões do topo, pesquisa com teclado aberto, menu inferior e janelas de edição, em especial num aparelho com notch/Dynamic Island. O layout foi verificado com tamanhos de iPhone e insets/teclado simulados em navegador; isto não substitui a confirmação num iPhone físico.
