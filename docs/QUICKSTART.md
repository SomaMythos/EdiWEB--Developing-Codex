# Quickstart - EDI Web

## 1. Instalar dependências

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

## 2. Configuração mínima

O frontend já pode funcionar com a configuração padrão, mas o cenário recomendado é usar as mesmas bases abaixo:

```env
VITE_API_URL=/api
VITE_BACKEND_URL=http://127.0.0.1:8000
```

Se quiser, copie `frontend/.env.example` para `frontend/.env` e ajuste a partir dele.

## 3. Subir o projeto

### Opção A: Windows com janelas visíveis

```bat
start_edi.bat
```

### Opção B: Windows silencioso

```text
Execute start_edi_silent.vbs
```

Esse modo inicia backend e frontend em segundo plano e abre `http://localhost:3000` automaticamente no navegador padrão.

### Opção C: acesso externo por Cloudflare

```bat
start_edi_cloudflare.bat
```

Se não houver túnel nomeado configurado, o script sobe um quick tunnel temporário `trycloudflare.com`.

### Opção D: manual

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

## 4. URLs esperadas

- App: `http://localhost:3000`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

## 5. Primeiro login

- Na primeira execução, o backend gera a senha inicial no diretório persistente do EDI.
- O arquivo padrão fica em `~/Documents/EDI/auth_password.txt`, a menos que `EDI_STORAGE_DIR` esteja configurado.
- O hash correspondente fica em `auth_config.json` no mesmo diretório.

## 6. Fluxos rápidos para validar

### Núcleo

1. Abrir o app e fazer login.
2. Ir em Daily e gerar a agenda do dia.
3. Marcar ao menos um bloco como concluído.

### Metas

1. Criar uma meta.
2. Vincular uma atividade.
3. Alterar o status da meta.

### Hobbies

1. Leitura: criar livro e registrar sessão.
2. Artes visuais: cadastrar obra e enviar update com imagem.
3. Música: criar treino e registrar sessão.
4. Assistir: adicionar item à watchlist.

### Financeiro e shopping

1. Configurar renda.
2. Adicionar transação ou despesa fixa.
3. Criar item de shopping.
4. Registrar um consumível com restock.

### Configurações

1. Validar preferências de notificações.
2. Testar som local das notificações.
3. Criar o atalho silencioso da Área de Trabalho.
4. Ativar `Executar ao iniciar o Windows`, se desejar.

## 7. Documentos úteis

- [README.md](/D:/Studio/Projects/EdiWEB--Developing/README.md)
- [FEATURE_INVENTORY.md](/D:/Studio/Projects/EdiWEB--Developing/docs/FEATURE_INVENTORY.md)
- [CLOUDFLARE.md](/D:/Studio/Projects/EdiWEB--Developing/docs/CLOUDFLARE.md)
- [TROUBLESHOOTING.md](/D:/Studio/Projects/EdiWEB--Developing/docs/TROUBLESHOOTING.md)
