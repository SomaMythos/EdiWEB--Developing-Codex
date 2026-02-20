import json
import csv
from pathlib import Path
from datetime import date, datetime
import logging

from data.database import Database

logger = logging.getLogger(__name__)


class ExportEngine:

    EXPORT_DIR = Path("exports")

    @staticmethod
    def _ensure_dir():
        ExportEngine.EXPORT_DIR.mkdir(exist_ok=True)

    # =========================
    # EXPORTAÇÃO JSON
    # =========================
    @staticmethod
    def export_json(filename=None):
        """
        Exporta todos os dados para JSON
        
        Args:
            filename: Nome customizado do arquivo (opcional)
        
        Returns:
            Caminho do arquivo exportado
        """
        try:
            ExportEngine._ensure_dir()
            db = Database()

            data = {}

            # Exportar todas as tabelas
            tables = [
                "user_profile",
                "user_metrics",
                "activity_types",
                "activities",
                "activity_metadata",
                "daily_logs",
                "daily_activity_logs",
                "routines",
                "routine_blocks",
                "goals",
                "goal_activities"
            ]

            for table in tables:
                try:
                    rows = db.fetchall(f"SELECT * FROM {table}")
                    data[table] = [dict(row) for row in rows]
                except Exception as e:
                    logger.warning(f"Erro ao exportar tabela {table}: {e}")
                    data[table] = []

            db.close()

            if not filename:
                filename = f"backup_{date.today().isoformat()}.json"
            
            file_path = ExportEngine.EXPORT_DIR / filename
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            logger.info(f"Dados exportados para JSON: {file_path}")
            return str(file_path)
        
        except Exception as e:
            logger.error(f"Erro ao exportar JSON: {e}")
            raise

    # =========================
    # EXPORTAÇÃO CSV
    # =========================
    @staticmethod
    def export_csv(tables=None):
        """
        Exporta dados para CSV (uma tabela por arquivo)
        
        Args:
            tables: Lista de tabelas específicas para exportar (opcional)
        
        Returns:
            Lista de caminhos dos arquivos exportados
        """
        try:
            ExportEngine._ensure_dir()
            db = Database()

            if tables is None:
                tables = [
                    "user_profile",
                    "user_metrics",
                    "activity_types",
                    "activities",
                    "activity_metadata",
                    "daily_logs",
                    "daily_activity_logs",
                    "routines",
                    "routine_blocks",
                    "goals",
                    "goal_activities"
                ]

            exported_files = []
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            for table in tables:
                try:
                    rows = db.fetchall(f"SELECT * FROM {table}")
                    if not rows:
                        logger.info(f"Tabela {table} vazia, pulando...")
                        continue

                    file_path = ExportEngine.EXPORT_DIR / f"{table}_{timestamp}.csv"
                    exported_files.append(str(file_path))

                    with open(file_path, "w", newline="", encoding="utf-8") as f:
                        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                        writer.writeheader()
                        for row in rows:
                            writer.writerow(dict(row))
                    
                    logger.info(f"Tabela {table} exportada: {file_path}")
                
                except Exception as e:
                    logger.error(f"Erro ao exportar tabela {table}: {e}")

            db.close()
            return exported_files
        
        except Exception as e:
            logger.error(f"Erro ao exportar CSV: {e}")
            raise

    # =========================
    # EXPORTAÇÃO ESPECÍFICA
    # =========================
    @staticmethod
    def export_activities_report(start_date=None, end_date=None):
        """
        Exporta relatório de atividades em um período
        
        Args:
            start_date: Data inicial (formato YYYY-MM-DD)
            end_date: Data final (formato YYYY-MM-DD)
        
        Returns:
            Caminho do arquivo exportado
        """
        try:
            ExportEngine._ensure_dir()
            db = Database()

            query = """
                SELECT 
                    dl.date,
                    a.title as activity,
                    at.title as type,
                    dal.duration,
                    dal.completed,
                    dal.timestamp
                FROM daily_activity_logs dal
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                JOIN activities a ON a.id = dal.activity_id
                JOIN activity_types at ON at.id = a.type_id
                WHERE 1=1
            """
            
            params = []
            if start_date:
                query += " AND dl.date >= ?"
                params.append(start_date)
            if end_date:
                query += " AND dl.date <= ?"
                params.append(end_date)
            
            query += " ORDER BY dl.date, dal.timestamp"
            
            rows = db.fetchall(query, tuple(params))
            db.close()

            if not rows:
                logger.warning("Nenhuma atividade encontrada no período")
                return None

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = ExportEngine.EXPORT_DIR / f"activities_report_{timestamp}.csv"

            with open(file_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                for row in rows:
                    writer.writerow(dict(row))

            logger.info(f"Relatório de atividades exportado: {file_path}")
            return str(file_path)
        
        except Exception as e:
            logger.error(f"Erro ao exportar relatório: {e}")
            raise

    @staticmethod
    def export_goals_progress():
        """
        Exporta relatório de progresso das metas
        
        Returns:
            Caminho do arquivo exportado
        """
        try:
            from core.goal_engine import GoalEngine
            
            ExportEngine._ensure_dir()
            goals = GoalEngine.list_goals()
            
            report_data = []
            for goal in goals:
                report_data.append({
                    "id": goal["id"],
                    "title": goal["title"],
                    "status": goal["status"],
                    "deadline": goal["deadline"],
                    "progress": GoalEngine.calculate_progress(goal["id"]),
                    "is_stalled": GoalEngine.is_stalled(goal["id"])
                })
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = ExportEngine.EXPORT_DIR / f"goals_progress_{timestamp}.csv"
            
            with open(file_path, "w", newline="", encoding="utf-8") as f:
                if report_data:
                    writer = csv.DictWriter(f, fieldnames=report_data[0].keys())
                    writer.writeheader()
                    for row in report_data:
                        writer.writerow(row)
            
            logger.info(f"Relatório de metas exportado: {file_path}")
            return str(file_path)
        
        except Exception as e:
            logger.error(f"Erro ao exportar relatório de metas: {e}")
            raise
