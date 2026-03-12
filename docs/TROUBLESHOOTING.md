# Troubleshooting - EDI Web

## O app não abre em `http://localhost:3000`

Verifique se backend e frontend realmente subiram.

### Subida manual

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

### Subida por script no Windows

- Use `start_edi.bat` para modo visível.
- Use `start_edi_silent.vbs` para modo silencioso.

## O launcher silencioso não abre nada

Confira estes pontos:

- `start_edi_silent.vbs` existe na raiz do projeto.
- `scripts/start_edi_hidden.ps1` existe e aponta para `scripts/run_backend_dev.bat` e `scripts/run_frontend_dev.bat`.
- O `icon.ico` está presente na raiz.
- O PowerShell está disponível no Windows.

Se necessário, teste o script oculto manualmente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start_edi_hidden.ps1
```

## O atalho da Área de Trabalho não foi criado

A criação do atalho depende do Windows Script Host e da integração local do backend.

Verifique:

- a API `GET /api/system/integration`
- o botão de criação em Configurações
- permissões da pasta `Desktop`

O atalho esperado fica em:

```text
C:\Users\<usuario>\Desktop\EDI Web.lnk
```

## `Run at Windows startup` não funcionou

O app usa um atalho na pasta Startup do Windows.

Caminho esperado:

```text
C:\Users\<usuario>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\EDI Web Startup.lnk
```

Se o toggle não surtir efeito:

- desative e ative novamente em Configurações
- confirme se o backend está rodando
- valide `GET /api/system/integration`

## O navegador abre, mas a senha não funciona

Verifique qual arquivo de senha o backend está lendo.

Pontos importantes:

- a senha atual fica no diretório persistente do EDI
- o arquivo padrão é `~/Documents/EDI/auth_password.txt`
- o hash correspondente fica em `auth_config.json`
- a URL pública antiga do quick tunnel pode já ter expirado

Para Cloudflare quick tunnel, sempre confirme a URL pública mais recente antes de testar o login.

## O quick tunnel do Cloudflare parou de funcionar

Isso é esperado para URLs `trycloudflare.com`.

- quick tunnels são temporários
- ao reiniciar, a URL muda
- para endereço fixo, use túnel nomeado com domínio seu

Veja [CLOUDFLARE.md](/D:/Studio/Projects/EdiWEB--Developing/docs/CLOUDFLARE.md).

## CORS ou API quebrando por host externo

O app foi ajustado para operar com `/api` no mesmo host público, mas confira:

- `VITE_API_URL=/api`
- `VITE_BACKEND_URL=http://127.0.0.1:8000`
- `EDI_CORS_ALLOW_ORIGIN_REGEX=https://.*\.trycloudflare\.com$`

Se estiver usando domínio próprio, revise `EDI_CORS_ALLOW_ORIGINS` ou a regex correspondente.

## Imagens ou uploads não aparecem externamente

O backend monta URLs públicas de upload com base no host da requisição. Se ainda falhar:

- confirme que o frontend acessa pelo mesmo host público
- verifique o proxy `/uploads`
- só defina `PUBLIC_UPLOADS_BASE_URL` se quiser sobrescrever manualmente a base pública

## Caracteres acentuados aparecem quebrados

O projeto já teve problema de mojibake em notificações e alguns textos antigos.

Situação atual:

- as notificações do backend são normalizadas ao ler e ao salvar
- a UI principal já foi corrigida
- o terminal do Windows ainda pode exibir acentos incorretamente por causa do encoding do console

Se a API estiver correta e o terminal mostrar texto quebrado, o problema pode ser apenas de exibição do console.

## `npm` falha no PowerShell com política de execução

Em alguns ambientes Windows, `npm` pode ser bloqueado por Execution Policy.

Use:

```powershell
npm.cmd run build
npm.cmd run dev
```

Isso evita o bloqueio do `npm.ps1`.

## `ModuleNotFoundError: No module named 'core'`

Execute o backend a partir da pasta `backend/`.

Errado:

```bash
uvicorn backend.main:app --reload
```

Correto:

```bash
cd backend
uvicorn main:app --reload
```

## Porta 8000 ou 3000 em uso

Backend em outra porta:

```bash
cd backend
uvicorn main:app --reload --port 8001
```

Se o frontend precisar mudar, ajuste a porta em `frontend/vite.config.js`.

## Frontend não sobe ou está desatualizado

```bash
cd frontend
npm install
npm.cmd run dev
```

Se precisar limpar:

```bash
cd frontend
rmdir /s /q node_modules
npm install
```

## Backend com erro de dependência

```bash
cd backend
pip install -r requirements.txt --force-reinstall
```

## Banco bloqueado ou estado inconsistente

Antes de pensar em apagar dados:

- feche processos duplicados do backend
- confirme se o launcher silencioso e o launcher visível não estão rodando ao mesmo tempo sem necessidade
- cheque o diretório persistente configurado em `EDI_STORAGE_DIR`

## Verificações rápidas

### Python

```bash
python --version
```

### Node.js

```bash
node --version
npm.cmd --version
```

### API

```bash
curl http://localhost:8000/
```

### Swagger

Abra:

```text
http://localhost:8000/docs
```
