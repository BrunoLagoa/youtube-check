# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

## [1.3.0] - 2026-07-02

### Added

- Remoção individual de vídeos do histórico pelo popup (botão × por item)
- Limpeza automática de histórico configurável ("Manter histórico por": sempre / 30 / 90 / 180 / 365 dias), com verificação diária via alarme
- Permissão `unlimitedStorage` para remover o limite de ~10MB do armazenamento local
- Contador flutuante agora pode ser arrastado para qualquer posição da tela (posição salva e sincronizada); clique duplo restaura o canto padrão
- Versão da extensão exibida no rodapé do popup e das configurações
- Ícones de LinkedIn e GitHub no rodapé
- Onboarding: tela de boas-vindas abre automaticamente na instalação, explicando como usar a extensão em 3 passos
- Estado vazio do popup (sem histórico) agora mostra os 3 passos e um botão "Abrir o YouTube"

## [1.2.1] - 2026-07-02

### Added

- Botão de fechar (×) no contador flutuante da página — some apenas na página atual; volta ao navegar para outra página/vídeo ou ao reabrir os Shorts. Desativação permanente continua nas configurações

## [1.2.0] - 2026-07-02

### Added

- Suporte a i18n (Inglês / Português) com seletor de idioma nas configurações
- Script de empacotamento agora inclui `_locales` para publicação

### Fixed

- Descrição da extensão fixada em inglês no manifest, independente do idioma da UI

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
