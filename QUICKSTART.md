# 🚀 Guia de Início Rápido - EDI Web

## Instalação Rápida

### 1. Instalar Dependências do Backend

```bash
cd backend
pip install -r requirements.txt
```

### 2. Instalar Dependências do Frontend

```bash
cd frontend
npm install
```

## Executar o Projeto

### Opção 1: Script Automático (Recomendado)

**Windows:**
```bash
start_edi.bat
```

**Linux/Mac:**
```bash
./start_edi.sh
```

### Opção 2: Manual (2 terminais)

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Acessar o Aplicativo

- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:8000
- **Documentação API**: http://localhost:8000/docs

## Primeiros Passos

1. **Criar Tipos de Atividade**
   - Acesse a página de Atividades
   - Antes de criar atividades, você precisa ter tipos
   - Exemplos: "Exercício", "Estudo", "Trabalho"

2. **Adicionar Atividades**
   - Clique em "Nova Atividade"
   - Preencha título, tipo e tempo estimado
   - As atividades aparecerão na tela inicial

3. **Registrar Atividades Diárias**
   - Na tela inicial (Home)
   - Selecione uma atividade
   - Defina duração e marque se concluiu
   - Clique em "Registrar"

4. **Criar Metas**
   - Acesse a página de Metas
   - Clique em "Nova Meta"
   - Defina título, descrição e prazo
   - Vincule atividades relevantes

## Solução de Problemas

### Backend não inicia
```bash
# Verifique se o Python está instalado
python --version

# Reinstale as dependências
pip install -r requirements.txt --force-reinstall
```

### Frontend não inicia
```bash
# Verifique se o Node.js está instalado
node --version

# Limpe e reinstale
rm -rf node_modules package-lock.json
npm install
```

### Porta já em uso
```bash
# Backend em outra porta
uvicorn main:app --reload --port 8001

# Frontend em outra porta (edite vite.config.js)
```

## Estrutura de Dados

### Banco de Dados
- Localização: `backend/data/lifemanager.db`
- Tipo: SQLite
- Criado automaticamente na primeira execução

### Schema Principal
- **activities**: Suas atividades
- **activity_types**: Tipos/categorias
- **daily_logs**: Registros diários
- **goals**: Suas metas

## Dicas de Uso

1. **Organize por Tipos**: Crie tipos antes de atividades
2. **Use Estimativas**: Defina tempos estimados para planejamento
3. **Registre Regularmente**: Mantenha o log diário atualizado
4. **Defina Metas**: Use metas para acompanhar objetivos maiores
5. **Revise Stats**: Acompanhe seu progresso regularmente

## Próximos Passos

- Explore todas as páginas do menu lateral
- Experimente diferentes tipos de atividades
- Configure metas de curto e longo prazo
- Acompanhe suas estatísticas

## Suporte

Para problemas ou dúvidas:
1. Verifique a documentação completa no README.md
2. Consulte a API docs em http://localhost:8000/docs
3. Verifique os logs no terminal

---

**Versão**: 2.0.0  
**Atualizado**: Fevereiro 2026
