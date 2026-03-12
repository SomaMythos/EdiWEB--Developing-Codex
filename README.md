# EDI - Life Manager Web

Aplicação web para gestão de rotina, metas, finanças, hobbies, notificações e acompanhamento pessoal, com backend em FastAPI, frontend em React + Vite e suporte a empacotamento desktop via Electron.

## Visão Geral

O projeto está ativo e funcional em três frentes:

- `backend/`: API REST, regras de negócio, autenticação, persistência SQLite e integrações locais do Windows.
- `frontend/`: SPA React com páginas por domínio, login, dashboard e fluxos operacionais do dia a dia.
- raiz do projeto: scripts de inicialização local, acesso externo por Cloudflare e launcher silencioso para Windows.

Hoje o backend expõe 174 endpoints HTTP em `backend/main.py`, e o frontend já cobre os principais domínios do app em produção local.

## Features Implementadas

### Núcleo do app

- Login por senha com geração de senha inicial fora do código e sessão por token em header.
- Planejamento diário com geração automática de agenda, resumo do dia, consistência e rotina por tipo de dia.
- Cadastro de atividades com frequências fixas/flexíveis, validação de conflitos de horário e log diário.
- Dashboard com visão consolidada, analytics e relatórios por domínio.
- Perfil do usuário com métricas corporais e histórico recente.
- Exportação de dados em JSON, CSV e relatórios específicos.

### Metas e produtividade

- CRUD completo de metas.
- Categorias de metas.
- Vínculo entre metas e atividades.
- Cálculo de progresso, total de estrelas e status.
- Detecção de metas estagnadas.

### Agenda, calendário e notas

- Calendário mensal e diário.
- Eventos manuais e registros no calendário.
- Blocos persistidos no planejamento do dia.
- Página de anotações no frontend.

### Notificações

- Central de notificações do app.
- Notificações customizadas.
- Preferências por feature.
- Alertas de metas sem progresso.
- Alertas de consumíveis.
- Resumo diário.
- Configuração local de som das notificações.
- Correção de textos com acentuação em mensagens novas e já persistidas.

### Financeiro

- Configuração de renda e parâmetros financeiros.
- Despesas fixas.
- Transações.
- Resumo financeiro.
- Projeção de longo prazo.
- Relatórios financeiros.

### Shopping e consumíveis

- Wishlist.
- Itens de compra e status.
- Estatísticas de shopping.
- Categorias de consumíveis.
- Restock e encerramento de ciclos de consumíveis.
- Alertas automáticos ligados ao centro de notificações.

### Hobbies

- Leitura: livros, sessões, estatísticas e tipos.
- Artes visuais: obras, updates, galeria, uploads e mídia de referência.
- Música: treinos, BPM, artistas, álbuns e histórico.
- Games: página dedicada no frontend.
- Assistir: watchlist por categoria e acompanhamento de itens assistidos.

### Operação e acesso

- Frontend configurado para operar com `/api` no mesmo host público.
- Uploads com URL pública derivada do host da requisição.
- Quick Tunnel do Cloudflare para acesso externo temporário.
- Suporte a túnel nomeado do Cloudflare para domínio fixo.
- Launcher silencioso no Windows sem janelas de prompt.
- Criação de atalho na Área de Trabalho com `icon.ico` do projeto.
- Opção em Configurações para ativar `Run at Windows startup`.
- Abertura automática de `http://localhost:3000` no navegador padrão ao usar o launcher silencioso.

## Modos de Inicialização

### 1. Inicialização visível local

Use [start_edi.bat](/D:/Studio/Projects/EdiWEB--Developing/start_edi.bat) para subir backend e frontend com janelas visíveis no Windows.

### 2. Inicialização silenciosa no Windows

Use [start_edi_silent.vbs](/D:/Studio/Projects/EdiWEB--Developing/start_edi_silent.vbs) para iniciar o app sem janelas de prompt. Esse launcher chama [start_edi_hidden.ps1](/D:/Studio/Projects/EdiWEB--Developing/scripts/start_edi_hidden.ps1), sobe backend/frontend em segundo plano e abre `http://localhost:3000` no navegador padrão.

### 3. Acesso externo por Cloudflare

Use [start_edi_cloudflare.bat](/D:/Studio/Projects/EdiWEB--Developing/start_edi_cloudflare.bat) para subir o ambiente local e publicar o app externamente via Cloudflare Tunnel. Mais detalhes em [CLOUDFLARE.md](/D:/Studio/Projects/EdiWEB--Developing/docs/CLOUDFLARE.md).

### 4. Execução manual

Backend:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

## URLs Principais

- App local: `http://localhost:3000`
- API local: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- URL pública temporária: `https://<subdominio>.trycloudflare.com`

## Autenticação e Persistência

- A senha inicial não fica hardcoded no código.
- Na primeira execução, o app gera uma senha individual e salva em `auth_password.txt` no diretório persistente do EDI.
- O hash e o salt ficam em `auth_config.json` no mesmo diretório.
- O diretório persistente padrão é `~/Documents/EDI`, a menos que `EDI_STORAGE_DIR` seja definido.
- O backend aceita token pelo header `x-edi-auth-token` ou por `Authorization: Bearer ...`.

Arquivos persistidos relevantes:

- `lifemanager.db`
- `auth_password.txt`
- `auth_config.json`
- `uploads/`

## Instalação

### Pré-requisitos

- Python 3.10+
- Node.js 18+
- npm
- Windows 10/11 para os recursos de atalho silencioso e inicialização automática

### Backend

```bash
cd backend
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Variáveis de Ambiente Úteis

### Frontend

- `VITE_API_URL=/api`: mantém frontend e API no mesmo host.
- `VITE_BACKEND_URL=http://127.0.0.1:8000`: alvo local do proxy do Vite.

### Backend

- `EDI_STORAGE_DIR`: define onde ficam banco, senha e uploads.
- `EDI_DEFAULT_PASSWORD`: define senha inicial manualmente.
- `EDI_AUTH_DISABLED=1`: desativa autenticação em cenários controlados.
- `EDI_CORS_ALLOW_ORIGINS`: lista de origins liberadas.
- `EDI_CORS_ALLOW_ORIGIN_REGEX`: regex para acesso externo, incluindo Cloudflare.
- `PUBLIC_UPLOADS_BASE_URL`: sobrescreve a base pública dos uploads.
- `EDI_NOTIFICATIONS_INTERVAL_SECONDS`: intervalo do scheduler de notificações.
- `EDI_NOTIFICATIONS_DAYS_AHEAD`: antecedência analisada pelo scheduler.

### Cloudflare

- `CLOUDFLARED_BIN`
- `CLOUDFLARE_TARGET_URL`
- `CLOUDFLARE_TUNNEL_TOKEN`

## Estrutura do Projeto

```text
backend/      API FastAPI, engines, banco e autenticação
frontend/     SPA React + Vite
scripts/      scripts auxiliares de execução
cloudflare/   exemplo de configuração de túnel nomeado
docs/         documentação complementar
main.js       empacotamento desktop via Electron
icon.ico      ícone usado no app e no atalho do Windows
```

## Documentação Complementar

- [QUICKSTART.md](/D:/Studio/Projects/EdiWEB--Developing/docs/QUICKSTART.md): setup rápido e validação inicial.
- [FEATURE_INVENTORY.md](/D:/Studio/Projects/EdiWEB--Developing/docs/FEATURE_INVENTORY.md): inventário de features, páginas e backends por domínio.
- [CLOUDFLARE.md](/D:/Studio/Projects/EdiWEB--Developing/docs/CLOUDFLARE.md): publicação externa via Cloudflare Tunnel.
- [TROUBLESHOOTING.md](/D:/Studio/Projects/EdiWEB--Developing/docs/TROUBLESHOOTING.md): problemas comuns e soluções.
- [CODEBASE_ANALYSIS.md](/D:/Studio/Projects/EdiWEB--Developing/docs/CODEBASE_ANALYSIS.md): análise técnica da base.
- [MIGRATION.md](/D:/Studio/Projects/EdiWEB--Developing/docs/MIGRATION.md): contexto de migração e legado.

## Status Atual

O projeto já cobre os principais fluxos operacionais do EDI Web, incluindo uso local, autenticação, notificações, exportação, hobbies, finanças e acesso externo por Cloudflare. Os próximos ganhos tendem a ser expansão de testes automatizados, refinamento de UX e aprofundamento de domínios que ainda estão mais leves no frontend, como Games e Notas.
