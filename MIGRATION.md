# 📋 Guia de Migração - Kivy para Web

## Mudanças Principais

### Arquitetura

**Antes (Kivy):**
```
EDI/
├── ui/          # Interface Kivy/KivyMD
├── core/        # Lógica de negócio
└── data/        # Banco de dados
```

**Agora (Web):**
```
edi-web/
├── backend/     # API FastAPI + core + data
└── frontend/    # Interface React
```

### Interface

| Antes (Kivy) | Agora (Web) |
|--------------|-------------|
| KivyMD widgets | React components |
| Python UI | JavaScript/JSX |
| Desktop app | Web browser |
| Telas .py | Páginas .jsx |

### Backend

| Antes | Agora |
|-------|-------|
| Integrado no app | API REST independente |
| Chamadas diretas | HTTP requests |
| - | Documentação automática (Swagger) |

## Compatibilidade

### ✅ 100% Compatível

- **Banco de dados**: Mesmo SQLite, mesmo schema
- **Lógica de negócio**: Engines preservados sem alterações
- **Dados**: Você pode usar o mesmo arquivo `lifemanager.db`

### 🔄 Adaptado para Web

- **Interface**: Completamente redesenhada
- **Navegação**: Roteamento web (React Router)
- **Estilização**: CSS moderno ao invés de KivyMD
- **Componentização**: Componentes React reutilizáveis

## Migração de Dados

### Usar Dados Existentes

Se você já tem um banco de dados do EDI Kivy:

1. Localize o arquivo `lifemanager.db` do projeto Kivy
2. Copie para `edi-web/backend/data/lifemanager.db`
3. Inicie o projeto web normalmente

```bash
# Exemplo
cp /caminho/para/EDI/data/lifemanager.db /caminho/para/edi-web/backend/data/
```

### Começar do Zero

O banco será criado automaticamente na primeira execução.

## Funcionalidades

### ✅ Totalmente Implementadas

- [x] Gerenciamento de Atividades
- [x] Tipos de Atividade
- [x] Log Diário
- [x] Metas (Goals)
- [x] Dashboard com estatísticas
- [x] API REST completa

### 🚧 Em Desenvolvimento (eram placeholders no Kivy também)

- [ ] Sistema de Rotinas completo
- [ ] Analytics avançado
- [ ] Exportação de dados
- [ ] Notificações

## Vantagens da Versão Web

### 1. Acessibilidade
- Acesse de qualquer dispositivo com navegador
- Não precisa instalar aplicativo
- Multiplataforma nativo

### 2. Interface Moderna
- Design limpo e profissional
- Responsivo (funciona em mobile)
- Mais rápido e fluído

### 3. Desenvolvimento
- Ecosistema React (mais ferramentas)
- Hot reload no desenvolvimento
- Fácil adicionar novas features

### 4. Deploy
- Pode hospedar na nuvem
- Compartilhar com outros usuários
- API pode ser usada por outros apps

### 5. Manutenibilidade
- Separação clara backend/frontend
- Código mais organizado
- Fácil testar e debugar

## Desvantagens (trade-offs)

### Antes (Kivy)
✅ App desktop standalone
✅ Não precisa de servidor
❌ Interface menos moderna
❌ Apenas local

### Agora (Web)
✅ Interface moderna
✅ Multiplataforma
✅ Pode ser cloud
❌ Precisa de servidor rodando
❌ Requer navegador

## Comandos Equivalentes

### Executar Aplicativo

**Kivy:**
```bash
python main.py
```

**Web:**
```bash
# Backend
uvicorn main:app --reload

# Frontend
npm run dev
```

### Dependências

**Kivy:**
```bash
pip install -r requirements.txt
```

**Web:**
```bash
# Backend
pip install -r backend/requirements.txt

# Frontend
npm install
```

## Estrutura de Código

### Engines (100% preservados)

Os engines funcionam exatamente igual:

```python
# Mesmo código em ambas as versões
from core.activity_engine import ActivityEngine

activities = ActivityEngine.list_activities()
ActivityEngine.create_activity(title="Correr", type_id=1)
```

### Interface

**Antes (Kivy):**
```python
# ui/screens/home.py
from kivy.uix.screenmanager import Screen

class HomeScreen(Screen):
    def on_enter(self):
        self.load_activities()
```

**Agora (React):**
```jsx
// pages/Home.jsx
import React, { useEffect } from 'react';

const Home = () => {
  useEffect(() => {
    loadActivities();
  }, []);
  
  return <div>...</div>;
};
```

## API Endpoints (novo)

A versão web adiciona API REST:

```bash
# Listar atividades
GET http://localhost:8000/api/activities

# Criar atividade
POST http://localhost:8000/api/activities
{
  "title": "Correr",
  "type_id": 1,
  "estimated_time": 30
}
```

Documentação completa: http://localhost:8000/docs

## Próximos Passos Recomendados

1. **Teste a versão web** com seus dados existentes
2. **Explore a API** em http://localhost:8000/docs
3. **Customize o frontend** se desejar
4. **Adicione novas features** usando a API
5. **Considere deploy** em nuvem se quiser acesso remoto

## Suporte

- README.md - Documentação completa
- QUICKSTART.md - Início rápido
- http://localhost:8000/docs - API docs

---

**Versão Web**: 2.0.0  
**Versão Original Kivy**: 1.1.0  
**Compatibilidade de Dados**: 100%
