# Modelos dos cartazes

Os JPEG originais mantêm-se intactos. Os ficheiros `*-clean.png` são versões restauradas com os exemplos de nomes, datas, horas e resultados removidos através da ferramenta de edição de imagem.

O gerador usa os JPEG originais como base e copia dos PNG apenas os retângulos dos campos variáveis. Os restantes píxeis do cabeçalho, logótipos, ilustrações, molduras e slogan vêm dos originais. Não voltar a usar retângulos opacos para esconder dados impressos.

Os modelos continuam disponíveis apenas pela rota autenticada de administrador. O teste de exportação compara o cabeçalho gerado com o original para impedir alterações acidentais ao grafismo.

`fixtures-ouro.png` e `results-prata.png` adaptam apenas a primeira linha à divisão em falta no exemplo original. O gerador utiliza apenas essa linha, mantendo o cabeçalho e rodapé originais.

O modelo `cartaz_diario_ranking.jpeg` define o grafismo atual dos jogos normais, com caixas laterais para as posições guardadas em cada jogo. Os PNG `fixtures-ranked-*` fornecem os campos limpos e as variantes de divisão. A altura é variável: por defeito são incluídos todos os jogos selecionados; o administrador pode escolher a quantidade por imagem. O cabeçalho/rodapé e as linhas mantêm a escala original.
