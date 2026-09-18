# YouTube Check 🎬✓

> **Idiomas:** [English](README.md) | Português (Brasil)

Extensão Chrome que marca automaticamente vídeos do YouTube já avaliados (Like ou Dislike) como **Visualizados**, adicionando badges visuais nas thumbnails em toda a plataforma.

## Funcionalidades

- ✅ Detecta automaticamente vídeos curtidos ou não curtidos — e traz os Likes dados em outros dispositivos pela lista "Vídeos com Gostei"
- ✅ Também marca como visto pelo tempo assistido (ligado por padrão, entre 75% e 95%), mesmo sem avaliação
- ✅ Badge visual "✓ Visualizado" (ou overlay) nas thumbnails
- ✅ Funciona em Home, Busca, Canal, Playlists, Relacionados, Inscrições, Explorar, Shorts e na playlist ao lado do player
- ✅ Indicador na página do vídeo e nos Shorts ("Você já avaliou este vídeo" / "Você já assistiu a este vídeo")
- ✅ Contador flutuante e arrastável (vistos/total, ou progresso da playlist)
- ✅ MutationObserver para scroll infinito sem recarregar
- ✅ Popup com estatísticas (inclusive hoje / esta semana / este mês), histórico recente e ações (exportar/importar/limpar)
- ✅ Título completo dos vídeos nos cards (opcional, sem o corte em "…")
- ✅ Página de configurações (cor, texto, modo badge/overlay, ocultar visualizados, destacar não visualizados, título completo, retenção do histórico, idioma)
- ✅ Interface em Inglês / Português (Brasil)
- ✅ Persistência via `chrome.storage.local` e `chrome.storage.sync`
- ✅ Manifest V3 + Performance otimizada

## Instalação

### Modo Desenvolvedor

1. Abra o Chrome e acesse `chrome://extensions`
2. Ative o **Modo de desenvolvedor** (toggle no canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta `youtube-check/`
5. A extensão estará ativa — acesse o YouTube!

## Como usar

1. **Abra qualquer vídeo** no YouTube e dê Like ou Dislike
2. A extensão detecta automaticamente a avaliação e salva localmente
3. Ao navegar pelo YouTube (Home, Busca, etc.), vídeos avaliados aparecem com o badge **✓ Visualizado**
4. Clique no ícone da extensão para ver estatísticas
5. Acesse **Configurações** para personalizar a aparência

## Estrutura de arquivos

```
youtube-check/
├── manifest.json
├── _locales/               # só os textos do manifest (nome, descrição da loja)
│   ├── en/messages.json
│   └── pt_BR/messages.json
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── scripts/
│   └── package-extension.sh
└── src/
    ├── background/
    │   └── service-worker.js
    ├── content/
    │   ├── content.js
    │   └── content.css
    ├── i18n/
    │   ├── messages.js     # catálogo da interface (en / pt-BR)
    │   └── i18n.js
    ├── onboarding/
    │   ├── welcome.html
    │   ├── welcome.js
    │   └── welcome.css
    ├── popup/
    │   ├── popup.html
    │   ├── popup.js
    │   └── popup.css
    ├── options/
    │   ├── options.html
    │   ├── options.js
    │   └── options.css
    ├── storage/
    │   └── storage.js
    └── utils/
        ├── youtube-parser.js
        └── dom-observer.js
```

## Notas técnicas

- A detecção de like/dislike usa o atributo `aria-pressed` e `is-toggled` dos botões do YouTube
- O vídeo precisa ser aberto ao menos uma vez para que a avaliação seja registrada
- Dados salvos em `chrome.storage.local` (por dispositivo), uma chave por vídeo (`video:<id>`)
- Configurações salvas em `chrome.storage.sync` (sincronizadas entre dispositivos)

## Publicação na Chrome Web Store

### Gerar pacote para upload

```bash
chmod +x scripts/package-extension.sh   # apenas na primeira vez
npm run package
# ou: ./scripts/package-extension.sh
```

O ZIP será criado em `dist/youtube-check-v{versão}.zip`, com a versão lida do `manifest.json`.

### Documentação completa

Consulte [docs/chrome-web-store.md](docs/chrome-web-store.md) para:

- Textos prontos da listagem (descrição, permissões, propósito único)
- Como hospedar a [política de privacidade](store/privacy-policy.html)
- Checklist antes de enviar ao [Developer Dashboard](https://chrome.google.com/webstore/devconsole)

### Política de privacidade

Hospede o arquivo `store/privacy-policy.html` em uma URL HTTPS pública (ex.: GitHub Pages) e informe o link no painel da loja.

**URL ativa:** https://brunolagoa.github.io/youtube-check/store/privacy-policy.html
