# Changelog - EDI Life Manager

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [1.1.0] - 2026-02-04

### 🐛 Bugs Críticos Corrigidos

#### DailyLogEngine
- **[CRÍTICO]** Corrigido `list_day()` que não retornava campos `role`, `start`, `end` necessários para HomeScreen
  - Adicionado JOIN com `activity_types` para obter o campo `role`
  - Adicionado campo `start` (timestamp da atividade)
  - Adicionado campo `end` calculado (start + duration)
  - Isso corrigia erro fatal ao abrir a tela Home

#### ActivityEngine
- **[CRÍTICO]** Implementado método `get_progress()` que estava sendo chamado mas não existia
  - Calcula progresso baseado no tipo de atividade (frequência, duração, binário)
  - Retorna strings formatadas como "75%", "5 sessões", "2h 30min"
  - Usado pelo GoalEngine para calcular progresso de metas

#### GoalEngine
- Adicionado `db.commit()` faltante no método `create_goal()`
- Implementados métodos `link_activity()` e `unlink_activity()` para vincular atividades a metas

#### Database
- Adicionado Context Manager (`__enter__` e `__exit__`)
- Implementado logging para debug
- Adicionado tratamento de exceções
- Criada propriedade `lastrowid` para facilitar acesso ao último ID inserido

### ✨ Novos Recursos

#### Schema do Banco
- Criadas tabelas `goals` e `goal_activities`
- Adicionada constraint UNIQUE em `goal_activities(goal_id, activity_id)`
- Adicionado ON DELETE CASCADE para manter integridade referencial

#### NotificationEngine
- Expandido com novos métodos:
  - `check_upcoming_deadlines()` - Alerta deadlines próximos
  - `get_daily_summary()` - Resumo de atividades do dia
  - `get_all_notifications()` - Agregador de todas as notificações

#### ExportEngine
- Adicionados novos métodos:
  - `export_activities_report()` - Relatório de atividades por período
  - `export_goals_progress()` - Relatório de progresso de metas
- Melhorado tratamento de erros
- Adicionado logging
- Timestamp em nomes de arquivos para evitar sobrescritas

### 📝 Arquivos Novos

#### Documentação
- `README.md` - Documentação completa do projeto
- `CHANGELOG.md` - Este arquivo
- `requirements.txt` - Dependências Python

#### Configuração
- `config.py` - Arquivo centralizado de configurações

#### Ferramentas
- `migrate.py` - Script de migração para atualizar bancos existentes
- `test_basic.py` - Suite básica de testes

### 🔧 Melhorias

#### Logging
- Adicionado sistema de logging em todos os engines
- Logs informativos para operações de banco
- Logs de erro com stack trace

#### Código
- Conversão de CRLF para LF em todos os arquivos
- Melhor organização de imports
- Docstrings adicionadas em métodos importantes
- Type hints em alguns lugares (a expandir)

### 🗄️ Migrações de Banco

Execute `python migrate.py` para atualizar bancos existentes com:
- Tabelas `goals` e `goal_activities`
- Coluna `timestamp` em `daily_activity_logs`

### 📦 Dependências

Principais dependências:
- kivymd >= 1.1.1
- kivy >= 2.2.1
- python-dateutil >= 2.8.2

Dependências de desenvolvimento:
- pytest >= 7.4.0
- black >= 23.7.0
- flake8 >= 6.1.0

### 🚨 Breaking Changes

Nenhuma mudança quebra compatibilidade. Todas as alterações são retrocompatíveis.

### 📋 Notas de Atualização

Para usuários existentes:
1. Faça backup do seu banco de dados (`data/lifemanager.db`)
2. Execute `python migrate.py` para atualizar o schema
3. Execute `python test_basic.py` para validar instalação
4. Reinicie o aplicativo normalmente

### 🐛 Bugs Conhecidos

- Nenhum bug crítico conhecido após esta atualização

### 🎯 Próximas Versões

#### v1.2.0 (Planejado)
- [ ] Interface para editar atividades existentes
- [ ] Sistema de backup automático
- [ ] Gráficos no Analytics
- [ ] Exportação para PDF

#### v2.0.0 (Futuro)
- [ ] Sincronização em nuvem
- [ ] App mobile nativo
- [ ] API REST
- [ ] Widgets para desktop

---

## [1.0.0] - Data Original

### ✨ Versão Inicial

- Sistema básico de atividades
- Log diário
- Rotinas
- Interface KivyMD
- Banco SQLite

---

## Formato

Este changelog segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

Tipos de mudanças:
- `Added` (Adicionado) para novos recursos
- `Changed` (Modificado) para mudanças em recursos existentes
- `Deprecated` (Descontinuado) para recursos que serão removidos
- `Removed` (Removido) para recursos removidos
- `Fixed` (Corrigido) para correção de bugs
- `Security` (Segurança) para vulnerabilidades corrigidas
