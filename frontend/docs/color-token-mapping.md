# Mapeamento de cores fixas para tokens globais

## Escopo auditado
- `frontend/src/pages/*.css`
- `frontend/src/components/daily/*.css`
- arquivos JSX com `style={{...}}`

## Mapeamento padrão aplicado
- `#ffffff`, `#fff` → `var(--bg-primary)` / `var(--surface-elevated)`
- `#111827` / fundos escuros de modal → `var(--surface-elevated)`
- `rgba(0,0,0,0.55~0.65)` overlay → `var(--surface-overlay)`
- cinzas de borda (`#3b475f`, `#4f5f7e`, `#596f95`, etc.) → `var(--border)` ou `var(--border-strong)`
- textos secundários claros (`#b8c5de`, `#cad7ed`) → `var(--text-secondary)`
- verde sucesso (`#22c55e`, `#1fcb66`) → `var(--accent-success)` / `var(--success)`
- vermelho erro (`#ef4444`, `#a35656`) → `var(--error)` / `var(--error-soft)`
- amarelo aviso (`#f59e0b`) → `var(--accent-warning)` / `var(--warning-state)`
- azul informativo (`#0ea5e9`) → `var(--accent-info)`
- roxo de destaque (`#7c3aed`) → `var(--accent-primary)`

## JSX inline tratados
- `Reminders.jsx`: `padding`/`marginTop` migrados para classes coesas.
- `Dashboard.jsx`: espaçamento e opacidade migrados para classes coesas.
- `Financeiro.jsx`: blocos de layout/tabela migrados para classes coesas; estilos de tooltip/linhas migrados para tokens CSS.
