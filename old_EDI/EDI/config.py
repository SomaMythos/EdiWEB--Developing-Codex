"""
Arquivo de Configuração do EDI - Life Manager
Centralize todas as configurações do aplicativo aqui
"""

import os

# =========================
# CONFIGURAÇÕES DO BANCO DE DADOS
# =========================

DATABASE_PATH = "data/lifemanager.db"
SCHEMA_PATH = "data/schema.sql"

# Habilitar logs SQL detalhados (DEBUG)
SQL_DEBUG = False

# =========================
# CONFIGURAÇÕES DE METAS
# =========================

# Número de dias sem progresso para considerar meta "parada"
STALE_GOAL_THRESHOLD_DAYS = 3

# =========================
# CONFIGURAÇÕES DE NOTIFICAÇÕES
# =========================

# Habilitar notificações push (requer implementação)
NOTIFICATIONS_ENABLED = False

# Horário para verificar metas paradas (formato HH:MM)
DAILY_CHECK_TIME = "20:00"

# =========================
# CONFIGURAÇÕES DE INTERFACE
# =========================

# Tema do aplicativo
APP_THEME = "Light"  # Opções: "Light", "Dark"
PRIMARY_COLOR = "Blue"  # Cor primária do tema

# Idioma
LANGUAGE = "pt_BR"  # Opções: "pt_BR", "en_US"

# =========================
# CONFIGURAÇÕES DE BACKUP
# =========================

# Habilitar backup automático
AUTO_BACKUP_ENABLED = True

# Frequência de backup automático (em dias)
BACKUP_FREQUENCY_DAYS = 7

# Diretório para backups
BACKUP_DIR = "data/backups"

# Número máximo de backups a manter
MAX_BACKUPS = 10

# =========================
# CONFIGURAÇÕES DE EXPORTAÇÃO
# =========================

# Diretório padrão para exportações
EXPORT_DIR = "exports"

# Formatos de exportação disponíveis
EXPORT_FORMATS = ["csv", "json", "xlsx"]

# =========================
# CONFIGURAÇÕES DE LOGGING
# =========================

# Nível de log (DEBUG, INFO, WARNING, ERROR, CRITICAL)
LOG_LEVEL = "INFO"

# Salvar logs em arquivo
LOG_TO_FILE = True
LOG_FILE_PATH = "data/edi.log"

# =========================
# CONFIGURAÇÕES DE DESENVOLVIMENTO
# =========================

# Modo de desenvolvimento (mostra mais informações de debug)
DEBUG_MODE = False

# Recarregar automaticamente ao detectar mudanças
AUTO_RELOAD = False

# =========================
# FUNÇÕES AUXILIARES
# =========================

def ensure_directories():
    """Cria diretórios necessários se não existirem"""
    dirs = [
        "data",
        "data/backups",
        "exports",
        "assets"
    ]
    for directory in dirs:
        os.makedirs(directory, exist_ok=True)


def get_config(key, default=None):
    """
    Obtém valor de configuração
    
    Args:
        key: Nome da configuração
        default: Valor padrão se não encontrado
    
    Returns:
        Valor da configuração
    """
    return globals().get(key, default)


def set_config(key, value):
    """
    Define valor de configuração dinamicamente
    
    Args:
        key: Nome da configuração
        value: Novo valor
    """
    globals()[key] = value


# Inicialização
if __name__ != "__main__":
    ensure_directories()
