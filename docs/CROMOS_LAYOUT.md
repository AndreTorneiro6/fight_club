# Layout dos cromos — 29 outubro 2026

Esta etapa implementa apenas o layout pedido antes do plano de trocas. Não ativa inventários transferíveis, negociações, chat, novas recompensas ou acesso de jogadores/espetadores à caderneta. O plano de trocas mantém-se para uma etapa posterior.

## Modelos e apresentação

- Ouro: `templates/cromo_ouro.jpeg`, publicado sem alterar bytes em `public/cromos/original-ouro.jpeg`.
- Prata/Bronze: `templates/cromo_prata_bronze.jpeg`, publicado sem alterar bytes em `public/cromos/original-prata-bronze.jpeg`. Cada divisão usa a sua área do original combinado, sem filtros nem redesenho.
- `PlayerStickerArtwork` partilha a arte entre o cartão pessoal editável, a frente da carta na prévia administrativa e a caderneta/saquetas. Mantém fotografia à direita, rating e iniciais à esquerda, nome, divisão e os seis atributos. Os campos sem uma autoavaliação guardada mostram travessões, sem inventar valores da coleção.
- Os valores são de autoavaliação pessoal, nunca de ranking/resultados oficiais. As estatísticas oficiais continuam nos cartões de competição. O verso cartoon/assinatura existente mantém-se.
- A caderneta mantém as permissões administrativas anteriores. Só a projeção de leitura do catálogo acrescenta os seis atributos/overall já guardados; não expõe versões/timestamps do perfil. Saquetas, quantidades, vales e regras não mudam.
- A ampliação por diálogo nativo permite ler os cromos no telemóvel. Fecha com Escape ou Fechar e mantém os cromos em falta sem fotografia/atributos revelados.
- Exportação pessoal usa exatamente o SVG da prévia em PNG1024×1536; exportação de duas faces mantém1520×1060. Ambas incorporam apenas os quatro ficheiros de arte explicitamente permitidos, fotografias locais autorizadas e cartoons locais já gerados. URLs externas continuam recusadas.
- IDs únicos do SVG usam `useId`, verificado na documentação React via Context7: https://react.dev/reference/react/useId.

## Preservação da arte

O JPEG original é sempre a base. Só retângulos com nomes, iniciais, rating e números de exemplo recebem textura restaurada dos WebP `fields-ouro.webp` e `fields-prata-bronze.webp`. Molduras, ícones, metal, luzes, título, etiquetas e rodapé permanecem nos píxeis originais. Fotografias e texto reais são colocados nas áreas correspondentes, com recorte de segurança.

As duas limpezas foram feitas com o skill imagegen e a ferramenta integrada image_gen (não CLI). Os PNG de saída ficaram na pasta Codex generated_images e foram codificados como WebP qualidade90 para os ficheiros do projeto. Cada saída é usada apenas nos retângulos variáveis, nunca como ilustração integral substituta.

Prompts finais:

### gold

Referência: `templates/cromo_ouro.jpeg`

> LOCAL TEXT CLEANUP ONLY, NOT A REDESIGN. Preserve the supplied gold padel player card exactly: its 1024x1536 composition, metallic gold frame, floodlights, padel court/fences, dark smoky textures, empty portrait cavity and its beveled gold border, header FIGHT CLUB · PADEL, division OURO, all six attribute rows and icons, and every color, light and decorative detail. Remove ONLY the example overall number 49, the example initials IT below it, the example player name Ivo Tavares, and the six example attribute values 15,17,53,51,57,18 in the right ends of the attribute rows. Reconstruct the exact dark/smoky texture behind removed name/initials and the existing metallic gold texture behind removed numbers. Preserve the printed RATING PESSOAL / AUTOAVALIAÇÃO text, the static labels Velocidade, Smash, Lob, Voleio, Defesa, Físico, the footer Atributos declarados pelo jogador · 0–99, all row borders and all empty portrait framing. Remove no other text or artwork. Do not add anything. Same full image at same composition and aspect ratio. Only tiny rectangles containing those removed example fields will be copied from your result over the UNTOUCHED original JPEG; all other pixels will come directly from the original.

### silver-bronze

Referência: `templates/cromo_prata_bronze.jpeg`

> LOCAL TEXT CLEANUP ONLY, NOT A REDESIGN. Preserve this exact 1458x1079 composite of two side-by-side player cards, SILVER on the left and BRONZE on the right. Do not move, crop, resize, merge or redesign either card. Preserve all original silver and bronze metallic frames, colors, lights, fencing, smoke, empty portrait cavities and beveled borders, headers FIGHT CLUB · PADEL, division labels PRATA and BRONZE, all six attribute rows, row metallic number panels and icons. On EACH card remove ONLY its example overall number 49, its example initials IT, the example name Ivo Tavares and its six example numeric attribute values 15,17,53,51,57,18. Smoothly restore original dark texture behind names/initials, original metal texture behind numeric values. Keep RATING PESSOAL / AUTOAVALIAÇÃO, labels Velocidade, Smash, Lob, Voleio, Defesa, Físico, footer Atributos declarados pelo jogador · 0–99 unchanged. Do not remove any other text or alter any illustration. Same exact full composite composition. Only tiny variable-data rectangles will be used from your result; all surrounding artwork will still come from the original JPEG.


## Verificação

Teste de igualdade binária dos originais e geometria dos campos. Comparação no navegador de cada cromo renderizado contra o JPEG original: zero píxeis alterados fora dos campos dinâmicos/fotografia, com pequena margem para antialias. Verifica valores reais incluindo0, nome completo dentro da moldura, fotos privadas, exportação das duas faces, cartão pessoal, filtros e caderneta privada/saquetas/ampliação/recompensas. As operações de teste usam apenas dados da demonstração isolada, sem alterar coleções reais.

