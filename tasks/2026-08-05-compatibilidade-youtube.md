# Plano de desenvolvimento — Compatibilidade com o YouTube (agosto/2026)

> **Status:** aberto · **Criado em:** 2026-08-05 · **Base:** `main` @ `61e1afa` · **Versão atual:** 1.5.0
> **Alvo de release:** 1.5.1 (correções de compatibilidade)

---

## 1. Contexto

O YouTube migrou boa parte dos componentes de `ytd-*-renderer` (Polymer) para os novos
`*-view-model`, **renomeou todas as classes CSS de BEM kebab-case para PascalCase** e
reestruturou o player de Shorts. A extensão foi escrita contra os seletores antigos, então
várias funcionalidades pararam de funcionar — algumas de forma **intermitente**, o que é o
sintoma mais difícil de diagnosticar (foi o caso reportado: "dei like e não marcou").

Todo o levantamento abaixo foi feito **contra o DOM real** do youtube.com em 2026-08-05
(navegador `Bruno`, sessão logada, pt-BR), não por suposição.

---

## 2. Mapa de mudanças confirmadas no DOM

### 2.1 Classes CSS: kebab-case BEM → PascalCase

Medido na watch page e na home (contagem de elementos que casam com cada seletor):

| Seletor antigo (usado no código) | Casos | Seletor atual | Casos |
| --- | --- | --- | --- |
| `.yt-lockup-metadata-view-model__title` | **0** | `a.ytLockupMetadataViewModelTitle` | 35 |
| `.yt-lockup-metadata-view-model-wiz__title` | **0** | *(idem acima)* | — |
| `.yt-lockup-view-model-wiz__content-image` | **0** | `a.ytLockupViewModelContentImage` | 20 |
| `img.yt-core-image` | **0** | `img.ytCoreImageHost` | 44 |
| `#video-title` (legado) | **0** | *(não existe mais)* | — |

Estrutura atual de um card `yt-lockup-view-model`:

```
div.ytLockupViewModelHost
  a.ytLockupViewModelContentImage
    yt-thumbnail-view-model
      div.ytThumbnailViewModelImage > img.ytCoreImageHost
  yt-lockup-metadata-view-model
    div.ytLockupMetadataViewModelTextContainer
      h3.ytLockupMetadataViewModelHeadingReset
        a.ytLockupMetadataViewModelTitle > span.ytAttributedStringHost   ← título
      div.ytLockupMetadataViewModelMetadata
        yt-content-metadata-view-model                                   ← canal + views
```

### 2.2 Watch page — botões de like/dislike

- `ytd-segmented-like-dislike-button-renderer` → **não existe mais** (0 ocorrências).
- `segmented-like-dislike-button-view-model` → **2 instâncias** dentro do mesmo
  `#top-level-buttons-computed`, por causa do double-buffer do `yt-smartimation`
  (uma visível, uma com `width: 0`).
- `like-button-view-model` → **3 a 5 instâncias** na página. Em ordem de DOM:

  | # | Onde está | Visível | `aria-label` |
  | --- | --- | --- | --- |
  | 1 | `#movie_player > yt-player-quick-action-buttons` | ❌ 0×0 | `marcar este vídeo como "Gostei"` |
  | 2 | `#top-level-buttons-computed > segmented-…-view-model` | ✅ | `marcar este vídeo como "Gostei"` |
  | 3 | `video-summary-content-view-model` (resumo por IA — **novo**) | ❌ | `Marcar este resumo com "Gostei"` |
  | 4 | buffer do `yt-smartimation` | ❌ | idem #2 |

  → `document.querySelector('like-button-view-model button[aria-label]')` devolve **o #1**,
  o botão invisível do overlay do player — não o botão real da barra de ações.

### 2.3 Player de Shorts (`/shorts/ID`) — reestruturado

Medido em `/shorts/EHLHzx_7QCc`:

| O que o código procura | Resultado hoje |
| --- | --- |
| `ytd-reel-video-renderer[is-active]` | **não existe** — o atributo `is-active` foi removido |
| `…[is-active] #overlay` | **não existe** |
| `…[is-active] .metadata-container` | **não existe** |
| `…[is-active] h2` / `#video-title` | **não existe** |
| `dislike-button-view-model` (Shorts) | **0 ocorrências** — não há botão de dislike |
| `ytd-shorts` / `#shorts-container` | ✅ ainda existem |
| `#player-container` dentro do reel | ✅ ainda existe |

Novos atributos no reel: `extract-action-bar`, `migrate-shorts-player-controls-to-cow`.
A barra de ações **saiu de dentro do reel** e agora vive em:

```
ytd-reel-player-overlay-renderer
  yt-reel-player-overlay-view-model
    reel-action-bar-view-model
      like-button-view-model > toggle-button-view-model > button-view-model
      button-view-model (comentários) | (compartilhar) | (remixes)
```

### 2.4 Shorts na home (shelf)

- `ytd-reel-item-renderer` → **0 ocorrências**.
- Agora: `ytm-shorts-lockup-view-model` (10) e `ytm-shorts-lockup-view-model-v2` (10) —
  **nenhum dos dois está em `VIDEO_ELEMENT_TAGS`**.

### 2.5 Playlists

- `ytd-playlist-video-renderer` → **0 ocorrências**; a playlist (inclusive `list=LL`) usa
  `yt-lockup-view-model` (100 itens). **Já coberto** pelo parser — sem ação necessária.

---

## 3. Situação por funcionalidade

| # | Funcionalidade | Status | Tarefa |
| --- | --- | --- | --- |
| 1 | Detecção de like/dislike na watch page | ⚠️ **intermitente** | T1 |
| 2 | Indicador "Você já avaliou este vídeo" na watch page | ⚠️ depende de T1 | T1 |
| 3 | Indicador "Você já avaliou" no player de Shorts | ❌ **quebrado** | T2 |
| 4 | Detecção de like/dislike no Shorts | ⚠️ like OK, dislike inexistente | T5 |
| 5 | "Exibir título completo" (v1.5.0) | ✅ **funcionando** (ver §3.1) | ~~T3~~ |
| 6 | Badge nos Shorts da home/shelf | ✅ **funcionando** (ver §3.1) | ~~T4~~ |
| 7 | Badge em listagens (home, busca, sidebar, playlist) | ✅ funcionando | — |
| 8 | Tint/hover do card marcado | ✅ funcionando (`yt-thumbnail-view-model`) | — |
| 9 | Contador flutuante da página | ✅ desligado manualmente pelo usuário | ~~T7~~ |
| 10 | Extração de canal/título dos cards | ⚠️ canal vinha vazio | T8 |
| 11 | Watch-progress (marcar por % assistida) | ✅ independente de DOM | — |
| 12 | Storage / popup / options / export-import | ✅ sem impacto | — |

### 3.1 Correções ao diagnóstico inicial

Três itens que eu havia marcado como quebrados **não estão**. Registro aqui porque o erro de
método vale mais que a conclusão:

- **"Exibir título completo" (T3)** — eu tinha medido só que os seletores *antigos* casavam com
  0 elementos e concluí que a feature estava morta. Faltou olhar que o `content.css:196` **já
  tinha** o seletor novo `a.ytLockupMetadataViewModelTitle`. Teste A/B no DOM real: com
  `html.ytcheck-full-title` → `line-clamp: none, overflow: visible, max-height: none`; sem a
  classe → `line-clamp: 2, max-height: 52px, overflow: hidden`. **Funciona**, inclusive nos
  Shorts (`h3.shortsLockupViewModelHostMetadataTitle`, clamp 2 → none, `max-height: 44px` → none).
- **Badge nos Shorts da home (T4)** — `ytd-reel-item-renderer` realmente sumiu, mas os
  `ytm-shorts-lockup-view-model(-v2)` estão **dentro de `ytd-rich-item-renderer`**, que já é
  uma tag coberta. Medido na home (10/10 Shorts com `data-ytcheck-id`) e em `/@canal/shorts`
  (45/45, thumbnail container = `yt-thumbnail-view-model`, `position: relative`). **Nada a fazer.**
- **Contador flutuante (T7)** — confirmado pelo Bruno: desligado manualmente nas opções.
  Comportamento correto.

Lição de método: contar ocorrências do seletor **antigo** só prova que o DOM mudou — não prova
que o código está quebrado. É preciso testar o comportamento (A/B com a classe/feature ligada e
desligada) antes de declarar regressão.

---

## 4. Tarefas

### T1 — 🔴 P0 · Detecção de like/dislike na watch page (bug reportado)

**Sintoma:** o usuário dá like e o selo "✓ Você já avaliou este vídeo" não aparece; às vezes
funciona, às vezes não. Reproduzido: em `watch?v=o5qx4h42lU4` o selo não apareceu; em outro
vídeo, apareceu normalmente.

**Causa-raiz (evidenciada):**

1. `_findLikeButton()` / `_findDislikeButton()` (`src/utils/youtube-parser.js:531-593`) usam
   `document.querySelector('like-button-view-model button[aria-label]')`, que retorna o botão
   **invisível** dentro de `yt-player-quick-action-buttons` (§2.2) — um componente que monta
   junto com o player, antes do estado real chegar, e cujo `aria-pressed` inicia em `"false"`.
2. `scheduleLikeDetection()` (`src/content/content.js:415`) para de tentar assim que
   `detectLikeDislikeState()` devolve **qualquer** coisa diferente de `null`. Como o botão
   fantasma já existe cedo, a leitura trava em `{liked:false, disliked:false}`.
3. `handleLikeDislikeState()` (`src/content/content.js:462`) então **persiste esse estado
   falso** e roda `viewedIds.delete(videoId)` — ou seja, uma leitura prematura não só falha em
   marcar, como **desmarca um vídeo que já estava marcado**.
4. `setupLikeObserver()` (`src/content/content.js:707`) observa o **primeiro**
   `segmented-like-dislike-button-view-model`; havendo dois buffers do `yt-smartimation`, uma
   troca de buffer pode não disparar o callback.
5. Risco adicional: o fallback por palavra-chave casa com os botões do **resumo por IA**
   (`Marcar este resumo com "Gostei"`), que é um componente novo.

**Arquivos:** `src/utils/youtube-parser.js`, `src/content/content.js`

**Implementado** (aguardando validação no navegador):

- [x] `_isUsableRatingButton(btn)` em `youtube-parser.js`: rejeita botão com caixa 0×0 e
      qualquer botão dentro de `video-summary-content-view-model`.
      **Decisão:** o `yt-player-quick-action-buttons` **não** entrou na blocklist — em tela cheia
      ele fica visível e passa a ser o controle real que o usuário clica. O teste de
      visibilidade já descarta a cópia fantasma fora da tela cheia e mantém a de tela cheia.
- [x] `_findRatingButton(kind, scope)` em camadas, substituindo `_findLikeButton` /
      `_findDislikeButton`: barra de ações real → qualquer `*-button-view-model` visível →
      renderers legados → `aria-label` (pt-BR + en, excluindo `resumo`/`summary`).
- [x] `detectLikeDislikeState()` devolve `null` enquanto não houver botão confiável — o retry
      continua e a gravação falsa deixa de existir. Novo campo `dislikeReadable`.
- [x] `handleLikeDislikeState()`: com `dislikeReadable === false`, preserva o `disliked` já
      gravado em vez de zerá-lo.
- [x] `setupLikeObserver()`: observa `#top-level-buttons-computed` (cobre os dois buffers do
      `yt-smartimation`), com `ytd-watch-metadata #actions` e os legados como fallback.
- [x] `YTDomObserver.observeAttributes` ganhou `options.childList` (opt-in, ligado só na watch
      page): o `yt-smartimation` pode trocar o estado **substituindo um nó**, o que não gera
      mutação de atributo nenhuma.
- [x] `scheduleLikeDetection`: `maxAttempts` 8 → 12 na watch page, já que agora os retries são
      o que atravessa a montagem assíncrona do YouTube.

**Critério de aceite:**
1. Abrir um vídeo **já curtido** → o selo aparece em ≤ 2 s, em 5/5 recarregamentos (F5).
2. Dar like em um vídeo não curtido → o selo aparece sem recarregar a página.
3. Remover o like → o selo some.
4. Navegar por SPA (clicar em vídeo da sidebar) → comportamento idêntico ao F5.
5. Um vídeo já marcado **nunca** é desmarcado por uma leitura prematura.

---

### T2 — 🔴 P0 · Indicador não aparece no player de Shorts

**Sintoma:** em `/shorts/ID`, o pill "Você já avaliou este vídeo" nunca é injetado.

**Causa-raiz:** `updateWatchIndicator()` (`src/content/content.js:655-659`) resolve a âncora por
`ytd-reel-video-renderer[is-active] #overlay` → `… .metadata-container` → `…[is-active]`.
**Os três seletores retornam `null`** hoje (§2.3): o atributo `is-active` deixou de existir e o
overlay saiu de dentro do reel. Sem âncora, a função retorna sem injetar nada.

Mesma causa afeta `getActiveShortsReel()` (`youtube-parser.js:133`),
`extractFromShortsPlayer()` (`:369`) e `extractCurrentVideoMeta()` (`content.js:442`).

**Arquivos:** `src/content/content.js`, `src/utils/youtube-parser.js`, `src/content/content.css`

**Implementado** (aguardando validação no navegador):

- [x] Novo `YTParser.getShortsIndicatorAnchor()`: `#overlay` → `.metadata-container` → **o próprio
      reel** → overlay renderer.
      **Decisão:** o reel é a âncora preferida, não o overlay. Medido no DOM: o reel é
      `position: relative` e sua caixa é exatamente a área do vídeo (365×649), enquanto o
      `ytd-reel-player-overlay-renderer` é mais largo (437) porque inclui a coluna da barra de
      ações — ancorar nele deslocaria o pill para fora do vídeo. O CSS de
      `.ytcheck-shorts-player-indicator` (`top: 52px; left: 16px`) continua válido sem mudança.
- [x] `updateWatchIndicator()` passa a usar essa função em vez dos três seletores `[is-active]`.
- [x] `getActiveShortsReel()` documentado: `[is-active]` é só a 1ª de 3 camadas; quem resolve
      hoje é o match por videoId da URL e a sobreposição com o viewport.
- [x] `_extractFromReelRenderer()`: fallback para o ID da URL quando o feed tem um único reel
      (o caso que substituiu o antigo `[is-active]`), sem chamar `getActiveShortsReel()` —
      isso causaria recursão.

**Critério de aceite:**
1. Abrir um Short já curtido → pill aparece sobre o player.
2. Rolar para o próximo Short → pill some/reaparece conforme o vídeo.
3. F5 direto em `/shorts/ID` → pill aparece.

---

### ~~T3 — "Exibir título completo"~~ — ❎ **cancelada, não era bug**

Ver §3.1. O `content.css:196` já tinha o seletor atual; validado por A/B no DOM real.
Nenhuma alteração feita.

---

### ~~T4 — Shorts da home sem badge~~ — ❎ **cancelada, não era bug**

Ver §3.1. Os `ytm-shorts-lockup-view-model(-v2)` ficam dentro de `ytd-rich-item-renderer`,
tag já coberta; 10/10 na home e 45/45 em `/@canal/shorts` estavam marcados. Nenhuma
alteração feita.

---

### T5 — 🟠 P1 · Shorts: dislike inexistente e metadados do reel

**Contexto:** no layout atual do Shorts **não há botão de dislike** (`dislike-button-view-model` = 0).
Hoje `_detectShortsLikeState()` degrada em silêncio (`_isButtonActive(null) === false`), o que é
aceitável — mas precisa ser explícito para não voltar como "bug". Além disso o título e o canal
do reel são lidos por seletores mortos (`h2`, `#video-title`, `ytd-channel-name` dentro do reel).

**Arquivos:** `src/utils/youtube-parser.js`, `src/content/content.js`

**Implementado** (aguardando validação no navegador):

- [x] Ausência de dislike tratada explicitamente via `dislikeReadable` (mesma guarda da T1) —
      um Short nunca mais zera um `disliked` gravado na watch page.
- [x] `extractFromShortsPlayer()`: título e canal agora são buscados **dentro do reel resolvido**
      (`getActiveShortsReel()`), não por `[is-active]` no documento. Fallback do título continua
      sendo `document.title`.
- [x] `extractCurrentVideoMeta()` (`content.js`) delega o canal do Short ao parser em vez de
      repetir seletores `[is-active]` mortos.
- [ ] Revalidar `getShortsRatingClickType` contra os `aria-label` atuais *(pendente — depende de
      um clique real de like/dislike; ver §6)*.

**Critério de aceite:** curtir/descurtir um Short reflete no histórico; o registro salvo tem
título e canal preenchidos.

---

### ~~T6 — Tint e hover do card marcado~~ — ❎ **cancelada, não era bug**

`content.css:158-181` já mira `yt-thumbnail-view-model`, que é exatamente o contêiner de
thumbnail dos cards atuais (confirmado em lockup, rich item e Shorts grid). Nenhuma alteração.

---

### ~~T7 — Contador flutuante~~ — ❎ **cancelada, não era bug**

Confirmado pelo Bruno: a opção foi desligada manualmente. Comportamento correto.

---

### T8 — 🟡 P2 · Extração de título/canal dos cards

**Observado:** em `yt-lockup-view-model` o título era resolvido via `h3 a` (funcionava por
acidente), mas o **canal vinha vazio**. Sem impacto visível hoje — esses campos não são
persistidos a partir de cards, o registro é gravado na watch page a partir do `document.title` —
mas é dívida que vira bug assim que alguém usar esses valores.

**Implementado:**

- [x] Título: `a.ytLockupMetadataViewModelTitle` como 1ª camada, legados mantidos abaixo.
- [x] Canal: novo `_extractChannelName(el)`.
      **Decisão:** não usar `yt-content-metadata-view-model` — o texto desse nó junta canal,
      visualizações e idade ("Canal • 1,4 mil visualizações • há 17 h"). A extração passa pelo
      link do canal (`a[href^="/@"]`, `a[href^="/channel/"]`), com filtro de "texto não vazio"
      porque o avatar também é um link — e é um link sem texto.
- [x] Thumbnail: `img.ytCoreImageHost` (era `img.yt-core-image`) e
      `.ytLockupViewModelContentImage` em `getThumbnailContainer`, ambos com o nome antigo
      mantido como fallback.
- [ ] ~~Helper `pick(el, [...seletores])`~~ — descartado: as cadeias de fallback têm ramificações
      por tipo de card, um helper genérico deixaria o código menos legível, não mais.

---

### T9 — ✅ Fechamento do release 1.5.1

Validado no navegador pelo Bruno antes do bump.

- [x] Bump de `version` em `manifest.json` **e** `package.json` → `1.5.1`.
- [x] Entrada `## [1.5.1] - 2026-08-05` em `CHANGELOG.md`.
- [x] `docs/store-description.en.md`, `docs/store-description.pt-BR.md` e
      `docs/chrome-web-store.md` atualizados (marcador de versão + "What's new"), EN e PT-BR
      em sincronia. As notas da 1.5.0 foram preservadas no guia, na seção de publicação
      acumulada.
- [x] `npm run package` → `dist/youtube-check-v1.5.1.zip` (77,3 KB, 37 arquivos).
- [ ] **Upload no dashboard da Chrome Web Store** ← ação manual do Bruno.
- [x] `CLAUDE.md` — sem mudanças necessárias: build, release e ordem de carregamento dos
      módulos continuam iguais.

### Validação executada

| Superfície | Resultado |
| --- | --- |
| Watch page, vídeo já curtido (`o5qx4h42lU4`) | ✅ indicador injetado em `#above-the-fold`, classe `ytcheck-watch--liked` |
| Watch page, dar Like ao vivo | ✅ validado manualmente pelo Bruno |
| Shorts player (`EHLHzx_7QCc`) | ✅ reel resolvido sem `is-active` (`data-ytcheck-id` correto), botão de like visível e legível |
| Listagens (home, busca, playlist, sidebar) | ✅ cards marcados, badges aplicados |

**Observação:** em aba de automação o `document.hidden` fica `true` e a animação CSS do
indicador não avança, deixando `opacity: 0` — é artefato do ambiente de teste, não da extensão.
Sempre confirmar visualmente com a aba em primeiro plano.

---

## 5. Ordem de execução sugerida

```
T1 ✅ código  ──▶  T2 ✅ código  ──▶  T5 ✅ código  ──▶  T8 ✅ código
                              │
                              ▼
                    VALIDAÇÃO NO NAVEGADOR  ← estamos aqui
                              │
                              ▼
                            T9 (release 1.5.1)

T3, T4, T6, T7 — canceladas (não eram bugs, ver §3.1)
```

**T1 primeiro**, conforme combinado — é o bug reportado e o de maior impacto (além de ser o
único que pode **apagar dados já marcados**).

---

## 6. Como validar

Não há suíte de testes: a validação é dirigir a extensão real no youtube.com.

1. `chrome://extensions` → recarregar o card da extensão → **F5** na aba do YouTube.
2. Usar o navegador **`Bruno`** (ver `CLAUDE.md` › *Browser automation*).
3. Superfícies mínimas por correção: home, `/results`, watch page (+ sidebar),
   `/playlist?list=LL`, `/shorts/ID`, shelf de Shorts da home.
4. Atenção: em aba **em segundo plano** (`document.hidden === true`) o YouTube não renderiza
   grades completas e animações CSS não avançam — validar sempre com a aba em primeiro plano.

---

## 7. Registro de decisões

| Data | Decisão |
| --- | --- |
| 2026-08-05 | Levantamento feito contra o DOM real (não por suposição); todos os seletores da §2 foram medidos com contagem de ocorrências. |
| 2026-08-05 | Corrigir **sem remover** os seletores antigos — manter o padrão em camadas (moderno → legado) já adotado no `youtube-parser.js`, porque o YouTube faz A/B test de DOM. |
| 2026-08-05 | T3, T4, T6 e T7 canceladas após teste comportamental: contar ocorrências do seletor antigo prova que o DOM mudou, não que o código quebrou (§3.1). |
| 2026-08-05 | Confiabilidade de botão = **caixa não-zero**, não blocklist de contêiner — assim o botão de tela cheia (`yt-player-quick-action-buttons`) continua funcionando quando é o controle real. |
| 2026-08-05 | `detectLikeDislikeState()` devolve `null` em vez de chutar `{false,false}`: o chute era o que apagava marcações existentes. |
