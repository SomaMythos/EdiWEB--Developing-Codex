# 🔧 Troubleshooting - EDI Web

## Erro: ModuleNotFoundError: No module named 'core'

### Solução 1: Verificar Estrutura

A estrutura do backend deve ser:

```
backend/
├── core/
│   ├── __init__.py
│   ├── activity_engine.py
│   ├── activity_type_engine.py
│   ├── daily_log_engine.py
│   ├── goal_engine.py
│   ├── routine_engine.py
│   ├── analytics_engine.py
│   ├── notification_engine.py
│   └── export_engine.py
├── data/
│   ├── __init__.py
│   ├── database.py
│   └── schema.sql
├── main.py
└── requirements.txt
```

### Solução 2: Executar do Diretório Correto

**IMPORTANTE**: Execute o uvicorn a partir da pasta `backend/`

```bash
# ERRADO ❌
cd edi-web
uvicorn backend.main:app --reload

# CORRETO ✅
cd edi-web/backend
uvicorn main:app --reload
```

### Solução 3: Criar __init__.py Manualmente (se necessário)

Se os arquivos `__init__.py` estiverem faltando:

**Windows (PowerShell):**
```powershell
cd backend\core
New-Item __init__.py -ItemType File -Force

cd ..\data
New-Item __init__.py -ItemType File -Force
```

**Windows (CMD):**
```cmd
cd backend\core
type nul > __init__.py

cd ..\data
type nul > __init__.py
```

**Linux/Mac:**
```bash
touch backend/core/__init__.py
touch backend/data/__init__.py
```

## Outros Erros Comuns

### Erro: Port already in use (Porta em uso)

**Solução:**
```bash
# Use outra porta
uvicorn main:app --reload --port 8001
```

### Erro: Module 'fastapi' not found

**Solução:**
```bash
cd backend
pip install -r requirements.txt
```

### Erro: npm command not found

**Solução:**
Instale o Node.js: https://nodejs.org/

### Erro: Database locked

**Solução:**
```bash
# Feche todas as instâncias do backend
# Ou apague o banco e deixe criar novamente
cd backend/data
rm lifemanager.db
```

### Frontend não carrega

**Solução:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### CORS Error

**Solução:**
Verifique se o backend está rodando em http://localhost:8000
O frontend está configurado para usar essa porta.

## Comandos de Verificação

### Verificar Estrutura

**Windows:**
```cmd
cd backend
dir /s /b
```

**Linux/Mac:**
```bash
cd backend
find . -type f
```

### Verificar Python

```bash
python --version
# Deve ser 3.8 ou superior
```

### Verificar Node.js

```bash
node --version
npm --version
```

### Testar Backend Isoladamente

```bash
cd backend
python -c "from core.activity_engine import ActivityEngine; print('OK')"
```

## Instalação Limpa

Se nada funcionar, siga estes passos:

### 1. Limpar Tudo

```bash
# Backend
cd backend
pip uninstall -y -r requirements.txt

# Frontend
cd frontend
rm -rf node_modules package-lock.json
```

### 2. Reinstalar Backend

```bash
cd backend
pip install -r requirements.txt
```

### 3. Reinstalar Frontend

```bash
cd frontend
npm install
```

### 4. Verificar Estrutura

Certifique-se de que os arquivos `__init__.py` existem em:
- `backend/core/__init__.py`
- `backend/data/__init__.py`

### 5. Executar

**Terminal 1:**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2:**
```bash
cd frontend
npm run dev
```

## Logs e Debug

### Ver Logs Detalhados (Backend)

```bash
cd backend
uvicorn main:app --reload --log-level debug
```

### Ver Logs (Frontend)

Os erros aparecem no console do navegador (F12)

### Testar API Diretamente

```bash
# Com curl
curl http://localhost:8000/

# Ou abra no navegador
http://localhost:8000/docs
```

## Suporte por Sistema Operacional

### Windows

- Use PowerShell ou CMD como administrador
- Pode ser necessário ajustar o Windows Defender
- Verifique variáveis de ambiente PATH

### macOS

- Pode precisar de Xcode Command Line Tools
- `xcode-select --install`

### Linux

- Pode precisar de python3-venv
- `sudo apt install python3-venv` (Ubuntu/Debian)

## Contato

Se o problema persistir:
1. Verifique a estrutura de pastas
2. Confirme que está executando do diretório correto
3. Tente instalação limpa
4. Verifique os logs de erro completos

---

**Última atualização**: Fevereiro 2026
