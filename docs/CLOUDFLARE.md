# Cloudflare Tunnel

O repositorio agora esta preparado para publicar o app web por um unico host externo via Cloudflare Tunnel.

## Como funciona

- O frontend Vite fica exposto na porta `3000`.
- O Vite faz proxy local de `/api` e `/uploads` para o backend FastAPI em `http://127.0.0.1:8000`.
- O Cloudflare Tunnel aponta somente para `http://localhost:3000`.
- Assim, externamente voce acessa o app inteiro por uma unica URL publica.

## Subida rapida

1. Inicie tudo junto:

```bat
start_edi_cloudflare.bat
```

2. Se nao houver token/config do Cloudflare, o script abrira um quick tunnel e mostrara uma URL `https://...trycloudflare.com`.
3. Acesse essa URL em qualquer dispositivo.

## Tunnel nomeado

Se voce ja tiver um tunnel criado no Cloudflare:

1. Copie `cloudflare/config.yml.example` para `cloudflare/config.yml`.
2. Preencha o `tunnel`, o `credentials-file` e o `hostname`.
3. Inicie:

```bat
scripts\start_cloudflare_tunnel.bat
```

Opcionalmente, voce tambem pode definir `CLOUDFLARE_TUNNEL_TOKEN` e o script usara `cloudflared tunnel run --token ...`.

## Variaveis uteis

- `CLOUDFLARED_BIN`: caminho do `cloudflared.exe` se nao estiver em `C:\cloudflare\cloudflared.exe`
- `CLOUDFLARE_TARGET_URL`: URL local que o quick tunnel deve publicar
- `VITE_API_URL=/api`: mantem frontend e API no mesmo host
- `VITE_BACKEND_URL=http://127.0.0.1:8000`: alvo local do proxy do Vite
- `EDI_CORS_ALLOW_ORIGIN_REGEX=https://.*\.trycloudflare\.com$`: libera acesso externo quando necessario

## Observacoes

- Para uso continuo, prefira tunnel nomeado com dominio seu em vez de quick tunnel.
- O backend agora monta URLs publicas de uploads a partir do host da requisicao, entao imagens continuam funcionando mesmo atras do Cloudflare.
