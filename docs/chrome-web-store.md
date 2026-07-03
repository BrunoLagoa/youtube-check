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

O arquivo será criado em `dist/youtube-check-v1.1.0.zip`.

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
• Ao navegar (Home, Busca, Canal, Playlists, Shorts…), vídeos já avaliados aparecem com o badge "✓ Visualizado"

Recursos
✓ Detecção automática de Like e Dislike
✓ Opcional: marcar como visto pelo tempo assistido — sinaliza o vídeo ao atingir uma porcentagem configurável (75%–95%, padrão 90%), mesmo sem avaliar (desligado por padrão)
✓ Badge ou overlay configurável nas thumbnails
✓ Suporte completo a YouTube Shorts
✓ Contador flutuante de vídeos vistos na página — dispensável por página e arrastável para qualquer posição (clique duplo restaura o canto)
✓ Indicador na página do vídeo ("Você já avaliou este vídeo")
✓ Popup com estatísticas e histórico recente — remova itens individuais ou limpe tudo
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
Ajudar o usuário a identificar visualmente vídeos do YouTube que ele já assistiu ou avaliou (curtido ou com dislike), exibindo badges nas thumbnails e estatísticas locais. Opcionalmente, também pode marcar como visto pelo tempo assistido (~90% do vídeo), quando o usuário ativa essa opção nas configurações — desligada por padrão.
```

### Justificativa de permissões

| Permissão | Justificativa |
|-----------|---------------|
| `storage` | Armazenar localmente o histórico de vídeos avaliados e as preferências do usuário (cor do badge, texto, etc.). |
| `unlimitedStorage` | Remove o limite padrão de ~10MB do `chrome.storage.local`, evitando falhas silenciosas ao salvar para usuários com histórico extenso. Nenhum dado sai do dispositivo do usuário. |
| `alarms` | Agenda uma verificação diária que aplica a limpeza automática de histórico (configurável em "Manter histórico por"), quando o usuário optar por não manter os dados para sempre. |
| `host_permissions: youtube.com` | Ler o estado dos botões de like/dislike nas páginas do YouTube e injetar badges visuais nas thumbnails. A extensão só funciona no YouTube. |

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

## Passo 6 — Notas da versão (What's new — v1.4.0)

Cobre tudo desde a última versão publicada (1.2.1): mudanças das 1.3.0 e 1.4.0.

```
• Mark videos as viewed by watch time — new opt-in setting (off by default) that flags a video once you've watched a configurable amount of it (75%–95%, default 90%), even without a Like or Dislike
• The floating page counter can now be dragged anywhere on screen (double-click to reset the corner), and stays dismissible per page
• Manage your history: remove individual videos from the popup, or set automatic cleanup (keep forever, or 30 / 90 / 180 / 365 days)
• New welcome page on install with a quick 3-step guide, plus a friendlier empty popup state
```

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
