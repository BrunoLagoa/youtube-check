# YouTube Check 🎬✓

Extensão Chrome que marca automaticamente vídeos do YouTube já avaliados (Like ou Dislike) como **Visualizados**, adicionando badges visuais nas thumbnails em toda a plataforma.

## Funcionalidades

- ✅ Detecta automaticamente vídeos curtidos ou não curtidos
- ✅ Badge visual "✓ Visualizado" nas thumbnails
- ✅ Funciona em Home, Busca, Canal, Playlists, Relacionados, Inscrições, Explorar, Shorts
- ✅ MutationObserver para scroll infinito sem recarregar
- ✅ Popup com estatísticas e ações (exportar/importar/limpar)
- ✅ Página de configurações (cor, texto, modo badge/overlay, ocultar visualizados)
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
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── src/
    ├── background/
    │   └── service-worker.js
    ├── content/
    │   ├── content.js
    │   └── content.css
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
- Dados salvos em `chrome.storage.local` (por dispositivo)
- Configurações salvas em `chrome.storage.sync` (sincronizadas entre dispositivos)
