# Publicação na Chrome Web Store

Guia para publicar o **YouTube Check** no [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Pré-requisitos

- [x] Conta de desenvolvedor criada e taxa paga
- [ ] Repositório no GitHub (recomendado, para hospedar a política de privacidade)
- [ ] ZIP gerado com `npm run package` ou `./scripts/package-extension.sh`

---

## Passo 1 — Hospedar a política de privacidade

A Chrome Web Store **exige** uma URL HTTPS pública para a política de privacidade.

### Opção recomendada: GitHub Pages

1. Crie um repositório público (ex.: `youtube-check`)
2. Faça push deste projeto
3. Em **Settings → Pages**, ative GitHub Pages na branch `main`, pasta `/store`
4. A URL ficará algo como:

   ```
   https://SEU-USUARIO.github.io/youtube-check/privacy-policy.html
   ```

5. Cole essa URL no campo **Privacy policy** do painel da loja

> O arquivo está em `store/privacy-policy.html`. Atualize o e-mail de contato antes de publicar.

---

## Passo 2 — Gerar o ZIP

```bash
./scripts/package-extension.sh
```

O arquivo será criado em `dist/youtube-check-v{version}.zip`, com a versão lida do `manifest.json`.

**Importante:** faça upload apenas do ZIP gerado. Não inclua `.git`, `docs/`, `store/` ou `scripts/`.

---

## Passo 3 — Criar item na loja

1. Acesse o [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. **New item** → faça upload do ZIP
3. Preencha os campos abaixo (textos prontos para copiar)

---

## Textos da listagem (copiar e colar)

### Nome

```
YouTube Check
```

### Descrição curta (máx. 132 caracteres)

```
Marca vídeos do YouTube que você já avaliou (Like ou Dislike) com o badge Visualizado.
```

### Descrição detalhada

```
YouTube Check ajuda você a não perder tempo com vídeos que já avaliou.

Como funciona
• Abra um vídeo no YouTube e dê Like ou Dislike
• A extensão salva a avaliação localmente no seu navegador
• Ao navegar (Home, Busca, Canal, Playlists, Shorts, a lista de recomendados e a playlist ao lado do vídeo), vídeos já avaliados aparecem com o badge "✓ Visualizado"

Recursos
✓ Detecção automática de Like e Dislike
✓ Marcar como visto pelo tempo assistido — sinaliza o vídeo ao atingir uma porcentagem configurável (75%–95%, padrão 90%), mesmo sem avaliar
✓ Badge ou overlay configurável nas thumbnails
✓ Opcional: exibir o título completo dos vídeos nos cards, sem o corte em "…"
✓ Suporte completo a YouTube Shorts
✓ Contador flutuante de vídeos vistos na página — mostra o progresso da playlist quando você está acompanhando uma lista; dispensável por página e arrastável para qualquer posição (clique duplo restaura o canto)
✓ Indicador na página do vídeo ("Você já avaliou este vídeo")
✓ Popup com estatísticas e histórico recente — inclui quantos vídeos você visualizou hoje, nesta semana e neste mês; remova itens individuais ou limpe tudo
✓ Limpeza automática do histórico (para sempre, ou 30 / 90 / 180 / 365 dias)
✓ Exportar e importar dados (JSON)
✓ Configurações sincronizadas entre dispositivos (Chrome Sync)
✓ Tela de boas-vindas na instalação e interface em Inglês / Português

Privacidade
• Nenhum dado é enviado para servidores externos
• Tudo fica armazenado localmente no seu navegador
• Você pode limpar o histórico a qualquer momento

Ideal para quem assiste muito YouTube e quer saber rapidamente o que já passou pelo feed.
```

### Descrição detalhada (English)

```
YouTube Check helps you avoid re-watching videos you've already rated on YouTube.

HOW IT WORKS
• Open any YouTube video and give it a Like or Dislike
• The extension saves your rating locally in your browser
• While browsing Home, Search, Channels, Playlists, Shorts, and both the suggested videos and the playlist queue beside the video you're watching, rated videos show a "✓ Viewed" badge on thumbnails

FEATURES
✓ Automatic Like/Dislike detection
✓ Mark as viewed by watch time — flags a video once you've watched a configurable amount of it (75%–95%, default 90%), even without rating it
✓ Configurable badge or overlay on thumbnails
✓ Optional: show the full video title on cards, with no "…" cut-off
✓ Full YouTube Shorts support
✓ Floating page counter (viewed/total on the current listing) — reports your progress through a playlist while you watch one; dismissible per page and draggable to any position (double-click to reset)
✓ Watch page indicator ("You already rated this video")
✓ Popup with statistics and recent history — including how many videos you've viewed today, this week and this month; remove individual videos or clear everything
✓ Automatic history cleanup (keep forever, or 30 / 90 / 180 / 365 days)
✓ Export and import your data (JSON)
✓ Settings synced across devices via Chrome Sync
✓ Welcome guide on install and English / Portuguese interface

PRIVACY
• No data is sent to external servers
• Everything is stored locally in your browser
• You can clear your history at any time from the extension popup

Perfect for anyone who watches a lot of YouTube and wants to quickly see what they've already rated.
```

### Categoria

```
Produtividade
```

### Idioma principal

```
Português (Brasil)
```

### Propósito único (Single purpose)

```
Ajudar o usuário a identificar visualmente vídeos do YouTube que ele já assistiu ou avaliou (curtido ou com dislike), exibindo badges nas thumbnails e estatísticas locais. Também marca como visto pelo tempo assistido (~90% do vídeo), com a porcentagem configurável e a opção desativável nas configurações.
```

### Justificativa de permissões

| Permissão | Justificativa |
|-----------|---------------|
| `storage` | Armazenar localmente o histórico de vídeos avaliados e as preferências do usuário (cor do badge, texto, etc.). |
| `unlimitedStorage` | Remove o limite padrão de ~10MB do `chrome.storage.local`, evitando falhas silenciosas ao salvar para usuários com histórico extenso. Nenhum dado sai do dispositivo do usuário. |
| `alarms` | Agenda uma verificação diária que aplica a limpeza automática de histórico (configurável em "Manter histórico por"), quando o usuário optar por não manter os dados para sempre. |
| `scripting` | Ativar a extensão nas abas do YouTube que já estavam abertas no momento da instalação. O Chrome só injeta os scripts declarados no carregamento seguinte da página, então sem isso essas abas ficam inertes até o usuário apertar F5. Usada uma única vez, na instalação, e apenas nas abas de youtube.com já cobertas por `host_permissions`. |
| `host_permissions: youtube.com` | Ler o estado dos botões de like/dislike nas páginas do YouTube e injetar badges visuais nas thumbnails. A extensão só funciona no YouTube. |

#### Textos prontos para colar na aba "Práticas de privacidade"

O painel bloqueia a publicação enquanto cada permissão do `manifest.json` não tiver
justificativa preenchida — inclusive as que já existiam, se a aba nunca foi revisada.
As justificativas ficam salvas entre envios; só é preciso preencher as novas.

`scripting` (nova na 1.8.0):

```
A permissão scripting é usada uma única vez, no momento da instalação, para ativar a extensão nas abas do YouTube que já estavam abertas.

O Chrome só injeta os content scripts declarados no manifesto quando a página é carregada novamente. Sem essa permissão, quem instala a extensão com o YouTube já aberto encontra uma aba em que nada funciona até apertar F5, o que gerou relatos de usuários de que a extensão estava quebrada.

Uso exato: no evento chrome.runtime.onInstalled, e somente quando reason === "install", a extensão chama chrome.scripting.insertCSS e chrome.scripting.executeScript nas abas cuja URL corresponde a https://www.youtube.com/* ou https://youtube.com/* — exatamente os hosts já declarados em host_permissions. Não é usada em atualizações nem em nenhum outro momento.

Os arquivos injetados são exclusivamente os arquivos locais já incluídos no pacote (os mesmos listados em content_scripts no manifest.json). Nenhum código remoto é baixado ou executado, nenhum dado é coletado e nenhuma outra aba ou site é acessado.
```

Versão em inglês, caso prefira responder ao revisor no idioma da revisão:

```
The scripting permission is used exactly once, at install time, to activate the extension in YouTube tabs that were already open.

Chrome only injects manifest-declared content scripts on a page's next load. Without this permission, a user who installs the extension while YouTube is already open finds a tab where nothing works until they press F5 — which led to user reports that the extension was broken.

Exact usage: inside the chrome.runtime.onInstalled event, and only when reason === "install", the extension calls chrome.scripting.insertCSS and chrome.scripting.executeScript on tabs whose URL matches https://www.youtube.com/* or https://youtube.com/* — precisely the hosts already declared in host_permissions. It is never used on updates or at any other time.

The injected files are exclusively local files already bundled in the package (the same ones listed under content_scripts in manifest.json). No remote code is fetched or executed, no data is collected, and no other tab or site is accessed.
```

### Uso de dados (Data usage)

No formulário de privacidade do painel, declare:

| Pergunta | Resposta |
|----------|----------|
| Coleta dados pessoais? | **Não** |
| Coleta histórico de navegação? | **Não** (apenas metadados de vídeos que o usuário avaliou, salvos localmente) |
| Usa criptografia? | N/A (dados locais) |
| Vende dados? | **Não** |
| Compartilha com terceiros? | **Não** |

---

## Passo 4 — Screenshots

A loja exige **pelo menos 1 screenshot** (recomendado: 3–5).

### Como capturar

1. Abra o YouTube com a extensão ativa
2. Capture telas mostrando:
   - Home com badges "✓ Visualizado"
   - Página de um vídeo com o indicador
   - Popup com estatísticas
   - Shorts com o contador
   - Página de configurações

### Tamanhos aceitos

- **1280×800** ou **640×400** (recomendado)
- Formato PNG ou JPEG

Salve em `store/screenshots/` para referência (não vão no ZIP da extensão).

---

## Passo 5 — Ícone da loja

Use `icons/icon-128.png` (já incluído no projeto).

---

## Passo 6 — Notas da versão (What's new — v1.8.1)

Se a v1.8.0 já foi publicada, use apenas a nota da 1.8.1:

**English**

```
• Fixed: Shorts in the Shorts carousel now get the "✓ Viewed" badge too — on a channel's Home tab and in search results, where they were skipped even though the very same Shorts were badged on the channel's Shorts tab
• Fixed: the floating counter no longer inflates the total on the Home feed — it was counting the same video more than once
• Fixed: a Short saved from a card now keeps its full title and its /shorts/ link
```

**Português (Brasil)**

```
• Correção: os Shorts do carrossel também recebem o badge "✓ Visualizado" — na aba Início do canal e nos resultados de busca, onde ficavam de fora mesmo com os mesmos Shorts marcados na aba Shorts do canal
• Correção: o contador flutuante não infla mais o total na Home — o mesmo vídeo estava sendo contado mais de uma vez
• Correção: um Short salvo a partir de um card mantém o título completo e o link /shorts/
```

Caso publique acumulando desde a 1.7.0, some as notas da 1.8.0 abaixo:

**English**

```
• Fixed: liking a video is now detected when you reach it by clicking a card too, with no page reload needed — this was why the extension seemed not to work right after installing
• Fixed: YouTube tabs already open when you install the extension now start working straight away, no refresh needed
• Changed: "mark as viewed by watch time" is now on by default, so watching a video through already counts towards Today, This week and This month
```

**Português (Brasil)**

```
• Correção: dar Like agora é detectado também quando você chega ao vídeo clicando num card, sem precisar recarregar a página — era o motivo de a extensão parecer não funcionar logo após a instalação
• Correção: abas do YouTube já abertas na hora da instalação passam a funcionar na hora, sem F5
• Mudança: "marcar como visto pelo tempo assistido" vem ligado por padrão, então assistir um vídeo até o fim já conta em Hoje, Esta semana e Este mês
```

Caso publique acumulando desde a 1.6.0, some as notas da 1.7.0 abaixo:

**English**

```
• New: the popup now shows how many videos you've viewed today, this week and this month, right below the statistics
```

**Português (Brasil)**

```
• Novo: o popup mostra quantos vídeos você visualizou hoje, nesta semana e neste mês, logo abaixo das estatísticas
```

Caso publique acumulando desde a 1.5.1, some as notas da 1.6.0 abaixo:

**English**

```
• New: the "✓ Viewed" badge now also shows in the video list beside the player — the playlist you're following, the autoplay queue and Mixes
• New: the floating counter reports your progress through the playlist (e.g. 11/47) while you watch one, instead of mixing the queue in with the suggested videos
```

**Português (Brasil)**

```
• Novo: o badge "✓ Visualizado" agora aparece também na lista de vídeos ao lado do player — a playlist que você está acompanhando, a fila de reprodução automática e os Mixes
• Novo: o contador flutuante mostra o progresso da playlist (ex.: 11/47) enquanto você assiste a uma lista, em vez de misturar a fila com os vídeos recomendados
```

Caso publique acumulando desde a 1.5.0, some também as notas da 1.5.1 abaixo:

```
• Fixed: Like/Dislike detection is reliable again on the watch page — YouTube changed its layout and the extension sometimes read the wrong button, leaving videos unmarked
• Fixed: already-marked videos are no longer un-marked on their own by an incorrect reading
• Fixed: liking a video now updates the badge immediately, with no page reload needed
• Fixed: the "You already rated this video" indicator is back on Shorts
```

```
• Correção: o Like/Dislike voltou a ser detectado de forma confiável na página do vídeo — o YouTube mudou o layout e a extensão às vezes lia um botão errado, deixando de marcar o vídeo
• Correção: vídeos já marcados não são mais desmarcados sozinhos por uma leitura incorreta
• Correção: dar Like agora atualiza o selo na hora, sem precisar recarregar a página
• Correção: o indicador "Você já avaliou este vídeo" voltou a aparecer nos Shorts
```

Caso publique acumulando desde a 1.4.2, some as notas da 1.5.0 abaixo:

```
• New: "Show full video title" setting — displays the complete title on video cards, with no "…" cut-off and no hovering needed (Home, Search, Channels, Playlists, Shorts and suggested videos). Off by default
```

```
• Novo: opção "Exibir título completo" — mostra o título inteiro dos vídeos nos cards, sem o corte em "…" e sem precisar passar o mouse (Home, Busca, Canal, Playlists, Shorts e recomendados). Desligada por padrão
```

Caso publique acumulando desde a 1.4.1, some as notas da 1.4.2 abaixo:

```
• Fixed: importing a JSON backup no longer drops videos that were marked as viewed by watch time
• Fixed: videos marked by watch time alone are no longer labelled "Disliked" in the popup history — they now have their own "Watched" tag
• Fixed: turning "Hide viewed videos" or "Highlight unviewed" off now restores the listing straight away, with no page reload needed
```

Caso publique acumulando desde a 1.2.1, some as notas da 1.3.0/1.4.x abaixo:

```
• Viewed badges now also appear on the "Up next" / suggested videos list beside the video you're watching (newer YouTube card layout), counted on the page counter too
• Mark videos as viewed by watch time — new opt-in setting (off by default) that flags a video once you've watched a configurable amount of it (75%–95%, default 90%), even without a Like or Dislike
• The floating page counter can now be dragged anywhere on screen (double-click to reset the corner), and stays dismissible per page
• Manage your history: remove individual videos from the popup, or set automatic cleanup (keep forever, or 30 / 90 / 180 / 365 days)
• New welcome page on install with a quick 3-step guide, plus a friendlier empty popup state
```

> A partir da v1.4.2 a descrição da extensão no `manifest.json` usa `__MSG_extDescription__`,
> traduzida em `_locales/{en,pt_BR}/messages.json`. Ao mudar a descrição curta da listagem,
> atualize também esses dois arquivos para não divergirem.

---

## Passo 7 — Distribuição

- **Visibilidade:** Público (ou Não listado para testar primeiro)
- **Países:** Todos ou Brasil + países de interesse
- **Preço:** Gratuito

---

## Checklist final antes de enviar

- [ ] ZIP gerado com `./scripts/package-extension.sh`
- [ ] Versão no `manifest.json` = versão no painel
- [ ] Política de privacidade online (HTTPS)
- [ ] E-mail de contato atualizado em `store/privacy-policy.html`
- [ ] Screenshots enviados
- [ ] Ícone 128×128 enviado
- [ ] Permissões justificadas
- [ ] Testado em Chrome limpo (perfil sem extensão em dev)

---

## Atualizações futuras

1. Incremente `version` no `manifest.json` (ex.: `1.1.1`, `1.2.0`)
2. Atualize `CHANGELOG.md`
3. Gere novo ZIP: `./scripts/package-extension.sh`
4. No painel: **Package** → upload do novo ZIP → enviar para revisão
