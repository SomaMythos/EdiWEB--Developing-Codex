"""
Dashboard Screen - Visão Geral do Dia
"""

from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.card import MDCard
from kivymd.uix.label import MDLabel
from kivy.metrics import dp
import random

from core.dashboard_engine import DashboardEngine
from core.daily_log_engine import DailyLogEngine
from core.goal_engine import GoalEngine
from core.settings_engine import SettingsEngine
from ui.components.header import ScreenHeader


class DashboardScreen(MDScreen):
    
    def on_enter(self):
        try:
            self.load_dashboard()
        except Exception as e:
            print(f"Erro ao carregar dashboard: {e}")
            import traceback
            traceback.print_exc()
    
    def load_dashboard(self):
        self.clear_widgets()
        
        root = MDBoxLayout(orientation="vertical", padding=dp(20), spacing=dp(15))
        
        # Header
        root.add_widget(ScreenHeader("Dashboard"))
        
        scroll = MDScrollView()
        container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True,
            padding=dp(10)
        )

        # Sugestão de Meta
        try:
            active_goals = GoalEngine.list_goals(status="ativa")
            if active_goals:
                active_goals = sorted(active_goals, key=lambda g: g.get("title", ""))
                suggestion = random.choice(active_goals)
                difficulty = suggestion.get("difficulty", 3) or 3
                try:
                    difficulty = int(difficulty)
                except (TypeError, ValueError):
                    difficulty = 3
                difficulty = min(max(difficulty, 1), 5)
                stars = "★" * difficulty + "☆" * (5 - difficulty)
                suggestion_card = self.create_card(
                    title="Sugestão de meta",
                    content=f"{suggestion.get('title', 'Meta')} \n{stars}",
                    color=(0.96, 0.74, 0.2, 1)
                )
                container.add_widget(suggestion_card)
        except Exception as e:
            print(f"Erro ao carregar sugestão de meta: {e}")
        
        # Score de Produtividade
        try:
            daily_stats = DailyLogEngine.get_daily_stats()
            if daily_stats and daily_stats.get("productivity_score") is not None:
                score = daily_stats["productivity_score"]
            else:
                score = DashboardEngine.get_productivity_score()
            score_card = self.create_card(
                title="Produtividade",
                content=f"{score}%",
                color=(0.24, 0.49, 0.86, 1)
            )
            container.add_widget(score_card)
        except Exception as e:
            print(f"Erro ao calcular score: {e}")

        # Preferências do Dia
        try:
            wake_time = SettingsEngine.get_setting("wake_time", "07:00")
            sleep_time = SettingsEngine.get_setting("sleep_time", "22:00")
            fixed_rule = SettingsEngine.get_setting("fixed_rule", "todos_os_dias")
            auto_rule = SettingsEngine.get_setting("auto_suggest_rule", "primeiro_bloco")
            work_days = SettingsEngine.get_work_days()
            is_workday = self.is_workday(work_days)
            fixed_label = {
                "todos_os_dias": "Todos os dias",
                "somente_trabalho": "Somente trabalho",
                "somente_folga": "Somente folga",
            }.get(fixed_rule, fixed_rule)
            auto_label = {
                "primeiro_bloco": "Primeiro bloco",
                "bloco_aleatorio": "Bloco aleatório",
            }.get(auto_rule, auto_rule)
            preferences_card = self.create_card(
                title="Preferências do dia",
                content=(
                    f"Horário: {wake_time} – {sleep_time}\n"
                    f"{'Dia de trabalho' if is_workday else 'Dia de folga'}\n"
                    f"Fixos: {fixed_label} | Auto: {auto_label}"
                ),
                color=(0.2, 0.7, 0.7, 1),
            )
            container.add_widget(preferences_card)
        except Exception as e:
            print(f"Erro ao carregar preferências: {e}")
        
        # Overview do Dia
        try:
            overview = DashboardEngine.get_today_overview()
            
            if overview and 'activities' in overview:
                acts = overview['activities']
                activities_card = self.create_card(
                    title="Atividades hoje",
                    content=f"{acts.get('completed', 0)}/{acts.get('total', 0)} concluídas\n"
                           f"{acts.get('total_minutes', 0)} minutos",
                    color=(0.27, 0.64, 0.45, 1)
                )
                container.add_widget(activities_card)
            
            if overview and 'reading' in overview:
                reading = overview['reading']
                status_counts = reading.get("status_counts", {})
                reading_card = self.create_card(
                    title="Leitura",
                    content=f"Novos: {status_counts.get('Novo', 0)}\n"
                           f"Iniciados: {status_counts.get('Iniciado', 0)}\n"
                           f"Concluídos: {status_counts.get('Concluído', 0)}",
                    color=(0.83, 0.47, 0.2, 1)
                )
                container.add_widget(reading_card)
            
            if overview and 'goals' in overview:
                goals = overview['goals']
                goals_card = self.create_card(
                    title="Metas",
                    content=f"{goals.get('active_goals', 0)} metas ativas\n"
                           f"{goals.get('stalled_goals', 0)} paradas",
                    color=(0.72, 0.27, 0.47, 1)
                )
                container.add_widget(goals_card)
                
        except Exception as e:
            print(f"Erro ao carregar overview: {e}")
        
        # Resumo Semanal
        try:
            weekly = DashboardEngine.get_weekly_summary()
            if weekly:
                weekly_card = self.create_card(
                    title="Semana",
                    content=f"{weekly.get('days_active', 0)} dias ativos\n"
                           f"{weekly.get('completion_rate', 0):.1f}% conclusão\n"
                           f"{weekly.get('total_hours', 0)} horas",
                    color=(0.5, 0.4, 0.8, 1)
                )
                container.add_widget(weekly_card)
        except Exception as e:
            print(f"Erro ao carregar resumo semanal: {e}")
        
        # Mensagem se vazio
        if container.children == []:
            empty_label = MDLabel(
                text="Comece a usar o EDI para ver\nsuas estatísticas aqui!",
                halign="center",
                font_style="H6",
                size_hint_y=None,
                height=dp(80),
            )
            container.add_widget(empty_label)
        
        scroll.add_widget(container)
        root.add_widget(scroll)
        
        self.add_widget(root)
    
    def create_card(self, title, content, color):
        """Cria um card colorido"""
        card = MDCard(
            orientation="vertical",
            padding=dp(15),
            spacing=dp(10),
            size_hint_y=None,
            height=dp(120),
            md_bg_color=color,
            radius=[15, 15, 15, 15]
        )
        
        title_label = MDLabel(
            text=title,
            font_style="H6",
            halign="center",
            bold=True
        )
        
        content_label = MDLabel(
            text=content,
            font_style="Body1",
            halign="center"
        )
        
        card.add_widget(title_label)
        card.add_widget(content_label)
        
        return card

    @staticmethod
    def is_workday(work_days):
        from datetime import date

        return date.today().weekday() in work_days
