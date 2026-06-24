# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

## [1.1.0] - 2026-06-24

### Added

- Suporte completo ao player de YouTube Shorts (detecção de like/dislike, contador de sessão, F5)
- Seletores para a UI moderna do YouTube (`like-button-view-model`, etc.)
- Captura de clique e polling de URL no feed de Shorts
- Script de empacotamento para Chrome Web Store (`scripts/package-extension.sh`)
- Política de privacidade (`store/privacy-policy.html`)
- Documentação de publicação (`docs/chrome-web-store.md`)

### Changed

- Contador em Shorts acumula vídeos vistos na sessão de rolagem
- Permissão `activeTab` removida (não necessária)
- `web_accessible_resources` removido (não utilizado)

### Fixed

- Extensão sumindo após F5 em páginas de Shorts
- Like/dislike não contabilizado do 2º short em diante
- Detecção de botões de like em páginas watch com UI nova

## [1.0.0] - 2026-06-24

### Added

- Lançamento inicial
- Badges "Visualizado" em vídeos curtidos ou com dislike
- Popup com estatísticas, histórico, export/import e limpar dados
- Página de configurações (cor, texto, badge/overlay, ocultar visualizados)
- Persistência via `chrome.storage.local` e `chrome.storage.sync`
