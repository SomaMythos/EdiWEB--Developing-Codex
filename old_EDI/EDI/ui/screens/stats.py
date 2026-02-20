from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.list import MDList, ThreeLineListItem
from kivymd.uix.label import MDLabel
from kivymd.uix.scrollview import MDScrollView
from kivy.metrics import dp

from core.analytics_engine import AnalyticsEngine
from ui.components.header import ScreenHeader


class StatsScreen(MDScreen):

    def on_enter(self):
        self.clear_widgets()
        self.build_ui()

    def build_ui(self):
        layout = MDBoxLayout(orientation="vertical", padding=dp(16), spacing=dp(12))
        layout.add_widget(ScreenHeader("Estatísticas"))

        scroll = MDScrollView()
        content = MDBoxLayout(
            orientation="vertical",
            padding=dp(8),
            spacing=dp(12),
            adaptive_height=True,
        )

        # =========================
        # RESUMO DO DIA
        # =========================
        summary = AnalyticsEngine.today_summary()

        content.add_widget(
            MDLabel(
                text="Resumo de Hoje",
                halign="center",
                font_style="H6"
            )
        )

        content.add_widget(
            MDLabel(
                text=(
                    f"Planejadas: {summary['planned']} | "
                    f"Concluídas: {summary['completed']}\n"
                    f"Tempo planejado: {summary['planned_time']} min | "
                    f"Executado: {summary['executed_time']} min"
                ),
                halign="center"
            )
        )

        # =========================
        # ÚLTIMOS DIAS
        # =========================
        content.add_widget(
            MDLabel(
                text="Últimos 7 dias",
                halign="center",
                font_style="H6"
            )
        )

        days_list = MDList()
        days = AnalyticsEngine.last_days()

        for d in days:
            days_list.add_widget(
                ThreeLineListItem(
                    text=d["date"],
                    secondary_text=f"Atividades: {d['done']}/{d['total']}",
                    tertiary_text=f"Tempo total: {d['total_time'] or 0} min"
                )
            )

        content.add_widget(days_list)

        # =========================
        # ATIVIDADES FREQUENTES
        # =========================
        content.add_widget(
            MDLabel(
                text="Atividades mais frequentes",
                halign="center",
                font_style="H6"
            )
        )

        top_list = MDList()
        top = AnalyticsEngine.top_activities()

        for a in top:
            top_list.add_widget(
                ThreeLineListItem(
                    text=a["title"],
                    secondary_text=f"Execuções: {a['executions']}",
                    tertiary_text=""
                )
            )

        content.add_widget(top_list)

        # =========================
        # PRODUTIVIDADE POR DIA
        # =========================
        content.add_widget(
            MDLabel(
                text="Produtividade por dia",
                halign="center",
                font_style="H6",
            )
        )

        productivity_list = MDList()
        productivity_days = AnalyticsEngine.productivity_by_day()

        if productivity_days:
            for d in productivity_days:
                productivity_list.add_widget(
                    ThreeLineListItem(
                        text=d["date"],
                        secondary_text=(
                            f"Produtividade: {d['productivity_score']}% | "
                            f"Concluídas: {d['completed_activities']}/{d['total_activities']}"
                        ),
                        tertiary_text=f"Tempo total: {d['total_time_minutes'] or 0} min",
                    )
                )
        else:
            productivity_list.add_widget(
                ThreeLineListItem(
                    text="Sem dados de produtividade",
                    secondary_text="Ainda não há estatísticas diárias registradas.",
                    tertiary_text="",
                )
            )

        content.add_widget(productivity_list)

        # =========================
        # HISTÓRICO DIÁRIO DETALHADO
        # =========================
        content.add_widget(
            MDLabel(
                text="Histórico diário detalhado",
                halign="center",
                font_style="H6",
            )
        )

        logs = AnalyticsEngine.daily_log_details()
        log_list = MDList()

        if logs:
            current_date = None
            for entry in logs:
                if entry["date"] != current_date:
                    current_date = entry["date"]
                    log_list.add_widget(
                        ThreeLineListItem(
                            text=current_date,
                            secondary_text="",
                            tertiary_text="",
                        )
                    )

                status = "Concluída" if entry["completed"] else "Pendente"
                duration = entry["duration"] or 0
                log_list.add_widget(
                    ThreeLineListItem(
                        text=entry["title"],
                        secondary_text=f"{status} • {duration} min",
                        tertiary_text=f"Início: {entry['timestamp'] or '--'}",
                    )
                )
        else:
            log_list.add_widget(
                ThreeLineListItem(
                    text="Sem atividades recentes",
                    secondary_text="Registre atividades para ver o log detalhado.",
                    tertiary_text="",
                )
            )

        content.add_widget(log_list)

        # =========================
        # ITENS PRÓXIMOS DE REPOSIÇÃO
        # =========================
        content.add_widget(
            MDLabel(
                text="Itens próximos de reposição",
                halign="center",
                font_style="H6",
            )
        )

        restock_list = MDList()
        restock_items = AnalyticsEngine.items_near_restock()

        if restock_items:
            for item in restock_items:
                restock_list.add_widget(
                    ThreeLineListItem(
                        text=item["name"],
                        secondary_text=item.get("restock_status") or "Perto de acabar",
                        tertiary_text=(
                            f"Dias desde reposição: {item.get('days_since_restock', 0)}"
                        ),
                    )
                )
        else:
            restock_list.add_widget(
                ThreeLineListItem(
                    text="Nenhum item urgente",
                    secondary_text="Todos os itens estão dentro do prazo.",
                    tertiary_text="",
                )
            )

        content.add_widget(restock_list)

        # =========================
        # METAS
        # =========================
        content.add_widget(
            MDLabel(
                text="Metas",
                halign="center",
                font_style="H6"
            )
        )

        goals_list = MDList()
        goals = AnalyticsEngine.goals_overview()

        for g in goals:
            status = "Parada" if g["stalled"] else "Ativa"
            goals_list.add_widget(
                ThreeLineListItem(
                    text=g["title"],
                    secondary_text=f"Progresso: {g['progress']}",
                    tertiary_text=status
                )
            )

        content.add_widget(goals_list)

        scroll.add_widget(content)
        layout.add_widget(scroll)
        self.add_widget(layout)
