from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.textfield import MDTextField
from kivymd.uix.button import MDRaisedButton

from ui.components.header import ScreenHeader
from core.routine_engine import RoutineEngine


class CreateRoutineScreen(MDScreen):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.name = "create_routine"

        root = MDBoxLayout(orientation="vertical")

        # Header
        root.add_widget(ScreenHeader("Criar rotina"))

        content = MDBoxLayout(
            orientation="vertical",
            padding="16dp",
            spacing="16dp"
        )

        self.period_field = MDTextField(
            hint_text="Nome do período (ex: Manhã)",
            required=True
        )

        self.start_field = MDTextField(
            hint_text="Hora início (HH:MM)",
            required=True
        )

        self.end_field = MDTextField(
            hint_text="Hora fim (HH:MM)",
            required=True
        )

        save_btn = MDRaisedButton(
            text="Salvar",
            pos_hint={"center_x": 0.5},
            on_release=self.save
        )

        content.add_widget(self.period_field)
        content.add_widget(self.start_field)
        content.add_widget(self.end_field)
        content.add_widget(save_btn)

        root.add_widget(content)
        self.add_widget(root)

    def save(self, *args):
        period = self.period_field.text.strip()
        start = self.start_field.text.strip()
        end = self.end_field.text.strip()

        if not period or not start or not end:
            return

        RoutineEngine.create_routine(period, start, end)

        self.manager.current = "routine"
