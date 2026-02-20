from kivymd.uix.screen import MDScreen
from kivymd.uix.list import MDList, ThreeLineListItem
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.scrollview import MDScrollView
from kivy.metrics import dp

from core.activity_engine import ActivityEngine
from ui.components.header import ScreenHeader


class ActivityHistoryScreen(MDScreen):

    def __init__(self, activity_id=None, activity_title="", **kwargs):
        super().__init__(**kwargs)
        self.activity_id = activity_id
        self.activity_title = activity_title

    def on_enter(self):
        self.clear_widgets()

        layout = MDBoxLayout(orientation="vertical", padding=dp(16), spacing=dp(12))
        layout.add_widget(ScreenHeader("Histórico", self.activity_title))

        scroll = MDScrollView()
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(10),
            adaptive_height=True,
            padding=dp(8),
        )

        history_list = MDList()
        history = ActivityEngine.get_history(self.activity_id)

        if not history:
            history_list.add_widget(
                ThreeLineListItem(
                    text="Nenhum registro encontrado",
                    secondary_text="",
                    tertiary_text=""
                )
            )
        else:
            for h in history:
                status = "Concluída" if h["completed"] else "Não concluída"
                extra = f"Extra: {h['extra_data']}" if h["extra_data"] else ""

                history_list.add_widget(
                    ThreeLineListItem(
                        text=f"{h['date']} — {status}",
                        secondary_text=f"Duração: {h['duration'] or '-'} min",
                        tertiary_text=extra
                    )
                )

        content.add_widget(history_list)
        scroll.add_widget(content)
        layout.add_widget(scroll)
        self.add_widget(layout)
