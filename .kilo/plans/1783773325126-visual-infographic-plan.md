# Plano: Recursos visuais/explicativos do Alfabeto Fonético Visual

## Objetivo
Criar recursos para comunicar e partilhar **como funciona a representação visual das imagens** (os "blocos" 7×7) do projeto MINIMAL PHONETICS, sem alterar o `index.html` existente. Inclui (a) um infográfico HTML auto-contido e (b) uma galeria de imagens exportadas geradas a partir do próprio código.

## Decisões confirmadas com o utilizador
- **Formato:** Ambos — página HTML infográfico + galeria de imagens exportadas.
- **Geração de imagens:** Script Node.js que extrai dicionário/regras do `index.html` (sem o alterar) e gera imagens em lote.
- **Conteúdo (foco):** Alfabeto de consoantes. Vogais/estados e regras de conversão aparecem apenas como ilustração nos exemplos de palavras.

## Princípio fundamental
**Não alterar `index.html`.** Todo o trabalho cria novos ficheiros em `recursos/`. O gerador de imagens **extrai** (`dicionario`, `vogaisAnteriores`, `vogaisPosteriores`, `converterTextoParaSistemaMajor`) do `index.html` por regex e reproduz fielmente o desenho de `exportBlocks` (cores, raio, grelha 7×7, legendas).

## Estrutura de ficheiros (todos novos)
```
recursos/
  guia.html            # Infográfico auto-contido (HTML + SVG inline) — partilhável/abrível no browser
  imagens/             # Galeria de imagens exportadas
    alfabeto-consoantes.svg
    exemplo-<palavra>.svg   # 2–3 palavras-exemplo (bloco em contexto)
  gerador/
    gerar-imagens.js   # Script Node.js (lê ../index.html, gera SVG)
    package.json       # devDependency opcional: sharp (para PNG)
```

## Gerador `recursos/gerador/gerar-imagens.js`
1. Lê `../index.html`. Extrai via regex os literais `const dicionario = {...};`, `const vogaisAnteriores = {...};`, `const vogaisPosteriores = {...};` e o corpo de `function converterTextoParaSistemaMajor(...) {...}`.
2. Avalia os objetos num `Function` isolado (sem DOM). A função de conversão é reconstruída a partir do código extraído para garantir fidelidade ao motor existente.
3. Replica a lógica de `renderText` / `aplicarVogal` e os **estados de vogal** (igual a `createDisplayGrid` + export SVG):
   - `1` = célula escura (`--grid-filled` `#2c3e50`)
   - `2` = vermelho cheio (`--grid-vowel` `#e74c3c`)
   - `3` = contorno vermelho 3px, fundo vazio (`#e0e0e0`)
   - `4` = contorno + diagonal TL→BR
   - `5` = contorno + X (TL→BR + TR→BL)
4. Mapeamento inverso dígito→consoantes (para rótulos): `0:S,Z · 1:T,D · 2:N · 3:M · 4:R · 5:L · 6:J,X · 7:K,Q,C,G · 8:F,V · 9:P,B`. Nota de ditongos: CH→6, LH→5, NH→2, RR→4, ç→0 (mostrado como rodapé, não no glifo).
5. Gera:
   - **alfabeto-consoantes.svg** — grelha de 10 glifos (0–9), cada um 7×7, com rótulo (dígito + consoantes mapeadas) por baixo. Layout tipo 5 colunas × 2 linhas.
   - **exemplo-<palavra>.svg** (2–3 palavras, ex.: `gato`, `casa`, `bombo`) — contact-sheet dos blocos com legendas de código fonético e texto original (replica `exportBlocks`, incluindo `legend-code-toggle`/`legend-text-toggle`).
6. Saída **SVG** (garantida, sem dependências nativas no Windows). PNG opcional via `sharp` (prebuilt no Windows) se instalado — o script não falha se `sharp` ausente.

## Infográfico `recursos/guia.html`
Secções (foco em Alfabeto Consoantes):
- Título + 1 parágrafo: o que é (alfabeto fonético visual; cada "bloco" = grelha 7×7).
- "Como ler um bloco": célula escura = consoante; célula vermelha = vogal (mini-explicação curta).
- Tabela HTML dígito → grupo de consoantes + incorporação inline de `alfabeto-consoantes.svg`.
- 2–3 exemplos de palavras renderizados (SVG inline) para ilustrar o alfabeto em contexto real.
- Nota breve de personalização/exportação (cores, tamanho, raio, espaçamento, PNG/SVG) referindo o painel do `index.html`.

Estilo: auto-contido (CSS inline), limpo, tipo infográfico, fácil de partilhar/imprimir.

## Validação
- `node recursos/gerador/gerar-imagens.js` gera os SVGs em `recursos/imagens/`.
- Abrir `recursos/guia.html` no browser e confirmar que as imagens aparecem e coincidem com o `index.html` (mesmos 10 glifos, mesmas cores, mesmas legendas nos exemplos).
- (Opcional) confirmar PNGs em `recursos/imagens/` se `sharp` instalado.

## Riscos / notas
- `canvas` (nativo, cairo) evitado no Windows; usa-se SVG puro + `sharp` opcional para PNG.
- Extração por regex depende da sintaxe atual de `index.html`; se o ficheiro mudar estruturalmente, o gerador pode precisar de ajuste (mas não alteramos o `index.html`).
- Escopo deliberadamente centrado nas consoantes; vogais/estados/conversão entram só como ilustração nos exemplos. Ampliável depois.
