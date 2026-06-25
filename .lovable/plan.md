## Objetivo
Corrigir as vulnerabilidades de dependências usando bumps reais apenas onde fazem diferença, e `overrides` para os transitivos. Nada de bump simbólico em exceljs/recharts.

## Bumps diretos (apenas estes)
| Pacote | De | Para |
|---|---|---|
| `@supabase/supabase-js` | 2.100.1 | **2.108.2** |
| `react-router-dom` | 6.30.1 | **6.30.4** |
| `xlsx` | 0.18.5 (npm) | **`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`** (CDN oficial SheetJS) |

## NÃO bumpar
- `exceljs` permanece em **4.4.0** (já é a última; bump é no-op).
- `recharts` permanece em **2.15.4** (já é a última 2.x; sem v3).

Os CVEs desses dois são resolvidos via `overrides`, não via bump.

## Overrides no `package.json` (corrige transitivos)
Adicionar exatamente:
```json
"overrides": {
  "lodash": "^4.17.21",
  "glob": "^10.4.5",
  "minimatch": "^9.0.5",
  "brace-expansion": "^2.0.2"
}
```
Cobre: lodash (code injection + prototype pollution sob recharts), glob (command injection sob exceljs), minimatch (ReDoS sob exceljs), brace-expansion (hang sob exceljs).

## Proibido
- Nada de React Router 7, nada de recharts 3.x.
- Nenhuma mudança em código, API, backend, RLS ou edge functions.

## Passos
1. `bun add @supabase/supabase-js@2.108.2 react-router-dom@6.30.4 xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
2. Editar `package.json` e inserir o bloco `overrides` acima.
3. `bun install` e `bun run build` — **só prossigo se o build passar limpo**.
4. Rodar `code--dependency_scan` e reportar exatamente o que saiu e o que ficou.
5. Chamar `security--manage_security_finding` com `mark_as_fixed` **somente** para o(s) finding(s) (`vulnerable_dependencies_high` e/ou `vulnerable_dependencies_medium`) que o rescan confirmar como resolvidos. O que continuar aparecendo, fica como está — sem mark_as_fixed, sem ignore.

Aprove para entrar em build mode e aplicar.