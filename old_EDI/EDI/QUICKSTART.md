# 🚀 Guia de Início Rápido - EDI Life Manager

Este guia vai te ajudar a configurar e usar o EDI em poucos minutos.

---

## 📥 Instalação Rápida

### Opção 1: Instalação Simples (Windows)

1. **Extraia o projeto** para uma pasta de sua escolha
2. **Abra o terminal** na pasta do projeto
3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Execute o aplicativo:**
   ```bash
   python main.py
   ```
   
   **OU** clique duas vezes em `EDI.bat`

### Opção 2: Com Ambiente Virtual (Recomendado)

```bash
# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Executar
python main.py
```

---

## 🎯 Primeiros Passos

### 1️⃣ Criar Tipos de Atividade

Antes de criar atividades, você precisa definir os **tipos**:

1. Vá para a aba **"Tipos"**
2. Clique em **"Adicionar Tipo"**
3. Exemplos de tipos:
   - 📚 **Estudo** (progresso: frequência)
   - 💪 **Exercício** (progresso: duração)
   - 💼 **Trabalho** (progresso: duração)
   - 🎮 **Lazer** (progresso: frequência)

### 2️⃣ Cadastrar Atividades

Agora crie suas atividades:

1. Vá para a aba **"Atividades"**
2. Clique em **"Adicionar Atividade"**
3. Preencha:
   - **Nome**: Ex: "Correr no parque"
   - **Tipo**: Selecione "Exercício"
   - **Tempo estimado**: 30 minutos
4. Clique em **"Salvar"**

### 3️⃣ Registrar Atividades do Dia

Use a tela **Home** para registrar o que você fez:

1. Registre atividades conforme você as completa
2. Marque como concluída
3. Defina a duração
4. O progresso é calculado automaticamente!

### 4️⃣ Criar uma Rotina

Monte sua rotina ideal:

1. Vá para **"Rotinas"**
2. Clique em **"Criar Nova Rotina"**
3. Defina o período: manhã, tarde, noite
4. Adicione blocos de tempo
5. Associe atividades aos blocos

### 5️⃣ Definir Metas

Estabeleça objetivos:

1. Vá para **"Metas"**
2. Clique em **"Nova Meta"**
3. Preencha:
   - **Título**: "Correr 100km este mês"
   - **Deadline**: 2026-02-28
4. **Vincule atividades** relacionadas
5. Acompanhe o progresso automaticamente!

---

## 💡 Dicas Importantes

### ✅ Boas Práticas

1. **Registre diariamente**: Mantenha o log sempre atualizado
2. **Seja específico**: Atividades bem nomeadas são mais fáceis de rastrear
3. **Use tipos corretamente**: Cada tipo tem um modo de progresso diferente
4. **Defina deadlines realistas**: Metas alcançáveis são mais motivadoras
5. **Revise semanalmente**: Use a aba Stats para analisar seu progresso

### ⚠️ Evite

1. ❌ Criar muitas atividades similares
2. ❌ Não registrar tempo gasto
3. ❌ Deixar o log vazio por dias
4. ❌ Criar metas muito ambiciosas
5. ❌ Ignorar notificações de metas paradas

---

## 🔧 Solução de Problemas

### Erro ao Abrir o App

```bash
# Erro: Module 'kivymd' not found
pip install kivymd

# Erro: Database locked
# Feche outras instâncias do app
```

### Banco de Dados Corrompido

```bash
# 1. Faça backup
cp data/lifemanager.db data/lifemanager.db.backup

# 2. Execute migração
python migrate.py

# 3. Se persistir, recrie
rm data/lifemanager.db
python main.py
```

### Migração para Versão Nova

```bash
# Execute o script de migração
python migrate.py

# Valide com os testes
python test_basic.py
```

---

## 📊 Entendendo o Sistema de Progresso

### Modos de Progresso

#### 1. **Frequência**
- Conta **quantas vezes** você fez
- Exemplo: "5 sessões de estudo"
- Ideal para: hábitos, treinos, leituras

#### 2. **Duração**
- Soma **tempo total** gasto
- Exemplo: "3h 45min de corrida"
- Ideal para: exercícios, trabalho, estudo

#### 3. **Binário**
- Apenas **feito ou não feito**
- Exemplo: "100%" ou "0%"
- Ideal para: tarefas únicas, marcos

#### 4. **Personalizado**
- Calcula **percentual** baseado em conclusões
- Exemplo: "75%" (3 de 4 sessões completas)
- Ideal para: projetos complexos

---

## 🎓 Exemplos de Uso

### Exemplo 1: Estudante

```
Tipos:
- 📚 Estudo (frequência)
- 📝 Exercícios (binário)
- 📖 Leitura (duração)

Atividades:
- Estudar Python (tipo: Estudo, 60min)
- Resolver lista de cálculo (tipo: Exercícios, 120min)
- Ler livro técnico (tipo: Leitura, 30min)

Meta:
- "Concluir curso de Python"
  - Vinculadas: Estudar Python, Resolver exercícios
  - Deadline: 2026-03-31
```

### Exemplo 2: Atleta

```
Tipos:
- 💪 Treino (duração)
- 🏃 Cardio (duração)
- 🧘 Alongamento (frequência)

Atividades:
- Musculação (tipo: Treino, 90min)
- Corrida (tipo: Cardio, 45min)
- Yoga (tipo: Alongamento, 30min)

Meta:
- "Correr 100km em fevereiro"
  - Vinculadas: Corrida
  - Deadline: 2026-02-28
```

### Exemplo 3: Profissional

```
Tipos:
- 💼 Trabalho (duração)
- 📧 Administração (frequência)
- 🎯 Projetos (personalizado)

Atividades:
- Desenvolvimento de features (tipo: Trabalho, 240min)
- Responder emails (tipo: Administração, 30min)
- Code review (tipo: Trabalho, 60min)

Meta:
- "Entregar MVP do projeto X"
  - Vinculadas: Desenvolvimento, Code review
  - Deadline: 2026-03-15
```

---

## 🔄 Fluxo de Trabalho Recomendado

### Diário (5 min)

1. **Manhã**: Revise sua rotina do dia
2. **Durante o dia**: Registre atividades conforme completa
3. **Noite**: Revise o que foi feito

### Semanal (15 min)

1. **Segunda**: Defina metas da semana
2. **Sexta**: Revise progresso semanal
3. **Domingo**: Planeje próxima semana

### Mensal (30 min)

1. Exporte relatórios
2. Analise estatísticas
3. Ajuste metas e rotinas
4. Faça backup do banco

---

## 📞 Precisa de Ajuda?

- 📖 Leia o **README.md** completo
- 🐛 Reporte bugs abrindo uma issue
- 💬 Dúvidas? Consulte a documentação
- 🔧 Execute `python test_basic.py` para diagnosticar problemas

---

## 🎉 Pronto para começar!

Agora você já sabe o básico. Explore as funcionalidades e adapte o EDI ao seu estilo de vida!

**Boa produtividade! 🚀**
