# 🚀 QUICKSTART — EDI Web

## 1) Instalar dependências

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

## 2) Configurar frontend (`.env`)

```bash
cd frontend
cp .env.example .env 2>/dev/null || touch .env
```

Edite `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
```

## 3) Subir o projeto

### Opção recomendada (script)

**Linux/macOS**
```bash
./scripts/start_edi.sh
```

**Windows**
```bat
scripts\start_edi.bat
```

### Opção manual

**Backend**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**
```bash
cd frontend
npm run dev
```

## 4) URLs

- App: `http://localhost:3000`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

---

## Primeiros fluxos para validar

1. **Daily**
   - abrir `/`
   - gerar agenda diária
   - marcar um bloco como concluído

2. **Goals**
   - criar uma meta
   - vincular uma atividade
   - alterar status (ativa/concluída/cancelada)

3. **Hobbies**
   - Leitura: criar livro e registrar sessão
   - Artes visuais: cadastrar obra e enviar update com imagem
   - Música: criar treino e registrar BPM

4. **Financeiro**
   - configurar renda
   - adicionar despesa fixa
   - consultar resumo/projeção

---

## Problemas comuns

### Porta 8000 ocupada
```bash
uvicorn main:app --reload --port 8001
```

### Porta 3000 ocupada
Ajuste `frontend/vite.config.js` (`server.port`) e reinicie o frontend.

### Erro de dependência no backend
```bash
cd backend
pip install -r requirements.txt --force-reinstall
```

### Erro de dependência no frontend
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

Para mais detalhes: `docs/TROUBLESHOOTING.md`.
