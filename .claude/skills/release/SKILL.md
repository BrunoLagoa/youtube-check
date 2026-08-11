---
name: release
description: Cortar uma nova versão do YouTube Check — bump de versão, CHANGELOG, os três docs de listagem da loja, validação no Chrome, npm run package, commit e push. Use sempre que o usuário pedir para lançar/publicar/versionar, gerar um build para a Chrome Web Store, ou disser "release", "cortar versão", "subir a versão", "bump", "empacotar para a loja".
---

# Release do YouTube Check

Executa o "Release flow" do `CLAUDE.md` sem pular etapas. **Todos os passos abaixo
fazem parte da mesma entrega** — um release com o ZIP gerado mas com os docs da loja
desatualizados está incompleto, porque os arquivos `docs/store-description.*` são o
que o usuário cola no dashboard.

Trabalhe na ordem. Marque o progresso com TaskCreate/TaskUpdate quando o release
tiver mais de dois ou três passos pendentes.

## 1. Definir a versão

Semver a partir do que mudou desde a última tag/commit de versão: recurso novo →
minor; só correções → patch; quebra de compatibilidade do storage ou remoção de
recurso → major. Se o usuário não disse qual é, diga qual você escolheu e por quê,
e siga — não bloqueie por isso.

Confira a versão atual em `manifest.json`.

## 2. Bump em dois arquivos

`manifest.json` e `package.json` devem ficar **idênticos**. Um sem o outro é um bug
silencioso: o ZIP herda o nome de `manifest.json` e o `package.json` fica mentindo.

## 3. CHANGELOG.md

Nova seção no topo, formato Keep a Changelog, em português:

```
## [x.y.z] - AAAA-MM-DD
```

Use a data real de hoje. Agrupe em `### Added` / `### Changed` / `### Fixed`.
Descreva o **efeito para o usuário** e, quando houver decisão técnica não óbvia
(campo novo no storage, fallback para dados antigos), registre o porquê — o
CHANGELOG deste projeto é detalhado de propósito.

## 4. Docs da loja — os três, em sincronia

1. `docs/store-description.en.md` — listagem canônica em inglês
2. `docs/store-description.pt-BR.md` — espelho em português (Brasil)
3. `docs/chrome-web-store.md` — guia de publicação, cujos blocos embutidos de
   descrição e "What's new" precisam bater com os dois arquivos acima

Em cada um:

- Atualize o marcador de versão do cabeçalho (`Current version:` / `Versão atual:`)
- Se o release muda o que a extensão faz, atualize a linha correspondente da lista
  de recursos — nos **dois** idiomas
- Substitua o bloco `[ WHAT'S NEW — version x.y.z ]` / `[ NOVIDADES — versão x.y.z ]`
  pela nota da nova versão
- Em `chrome-web-store.md`, o Passo 6 leva a nota nova no topo e **empilha** as
  anteriores abaixo ("Caso publique acumulando desde a …"), cada bloco rotulado
  **English** / **Português (Brasil)** — quem publica pulando versões precisa delas

## 5. CLAUDE.md

Atualize no mesmo release se a mudança alterou: passos de build/release, a ordem de
carregamento dos módulos (`manifest.json` → `content_scripts[].js`), o schema do
storage, ou o conjunto de docs que precisam ser mantidos.

## 6. Validar antes de empacotar

Não existe suíte de testes. Valide dirigindo a extensão de verdade:

- Rode `node --check` nos `.js` alterados — pega erro de sintaxe em segundos
- Superfícies do YouTube (badge, contador, indicador): use o Chrome chamado
  **`Bruno`**, o único com a extensão descompactada carregada. `list_connected_browsers`
  → `select_browser` pelo nome; se não aparecer, `switch_browser` e o usuário clica
  em Connect. Peça para ele recarregar a extensão em `chrome://extensions` antes
- Popup / options: essas páginas não são alcançáveis por `chrome-extension://` pelas
  ferramentas de automação. Copie `src/` e `icons/` para o scratchpad, injete um stub
  de `chrome` (precisa de `runtime.id`, senão `safeStorage` devolve o fallback e tudo
  aparece zerado) com dados sintéticos, sirva com `python3 -m http.server` e abra por
  `http://localhost:PORTA`. Derrube o servidor e apague a cópia ao terminar

## 7. Empacotar

```bash
npm run package
```

Gera `dist/youtube-check-v{version}.zip` a partir de `manifest.json` + `icons/` +
`src/` + `_locales/`. `dist/` é gitignored — o ZIP não entra no commit.

## 8. Commit e push

Este repositório commita **direto na `main`**, sem branches nem PRs. Mensagem no
padrão do histórico, em português: `feat(x.y.z): …` ou `fix(x.y.z): …`, corpo
explicando o porquê das decisões, e o trailer `Co-Authored-By:` exigido pelo
harness.

Depois `git push origin main`.

## 9. Tag e GitHub Release — só se pedirem

O repositório tem apenas a tag `v1.5.0`; releases posteriores não foram taggeados.
Não crie tag nem GitHub Release por conta própria: pergunte, e só faça se o usuário
confirmar.

## 10. Fechar dizendo o que sobrou para ele

O upload é manual. Termine informando: subir `dist/youtube-check-v{version}.zip` em
https://chrome.google.com/webstore/devconsole e colar as descrições de
`docs/store-description.en.md` e `docs/store-description.pt-BR.md` nos campos de cada
idioma.
