# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

## [1.5.0] - 2026-07-23

### Added

- Nova opção **"Exibir título completo"** (desligada por padrão): remove o corte de 2 linhas do YouTube nos cards de vídeo, mostrando o título inteiro sem "…" e sem precisar passar o mouse. Vale para Home, Busca, Canal, Playlists, cards de Shorts e a lista de recomendados ao lado do vídeo. O título da página do vídeo em si não é alterado (ele já tem o "…mais" nativo do YouTube)
- Tela de boas-vindas passa a apresentar a nova opção em um destaque próprio, logo acima dos botões

## [1.4.2] - 2026-07-22

### Fixed

- Importar um backup JSON não descartava mais os vídeos marcados como vistos **pelo tempo assistido** — o import do popup recalculava o status ignorando `watchedByProgress` e esses vídeos voltavam a aparecer como não vistos. O popup agora usa a mesma rotina de import do restante da extensão
- Vídeos marcados apenas pelo tempo assistido (sem like nem dislike) apareciam no histórico do popup com o selo "👎 Não curtido". Agora exibem um selo próprio "▶ Assistido"
- Desligar "Ocultar vídeos visualizados" ou "Destacar não visualizados" não restaurava os cards na página até apertar F5 — os estilos aplicados nunca eram removidos. Agora a mudança vale na hora, e desativar a extensão também limpa tudo
- Registros importados sem data de atualização recebiam data vazia e podiam ser apagados na primeira limpeza automática de histórico

### Changed

- Descrição da extensão na Chrome Web Store agora é traduzida (aparece em português para quem usa o navegador em português)

## [1.4.1] - 2026-07-18

### Added

- Badge "Visualizado" agora também aparece nos vídeos da **lista lateral** ("A seguir" / recomendados) da página de um vídeo. O YouTube passou a renderizar esses cards com o novo componente `yt-lockup-view-model`, que não era detectado — agora é. O contador de página também passa a contabilizá-los

### Fixed

- Cards de vídeo no layout atual do YouTube (`yt-lockup-view-model`) não recebiam badge nem entravam na contagem

## [1.4.0] - 2026-07-03

### Added

- Porcentagem de tempo assistido configurável para a marcação automática por tempo (75% / 80% / 85% / 90% padrão / 95%). O seletor aparece apenas quando a opção "Marcar como visto pelo tempo assistido" está ligada

### Changed

- Descrição da opção "Marcar como visto pelo tempo assistido" deixou de fixar "90%" para refletir a porcentagem configurável

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
- Opção (desligada por padrão) para marcar um vídeo como visto ao assistir ~90% dele, mesmo sem dar like/dislike — "Marcar como visto pelo tempo assistido" nas configurações

### Changed

- Propósito único e política de privacidade atualizados na documentação da loja para refletir a nova opção de marcação por tempo assistido

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
