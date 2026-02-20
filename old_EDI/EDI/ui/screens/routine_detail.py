from kivy.uix.boxlayout import BoxLayout
from kivy.metrics import dp

from kivymd.uix.screen import MDScreen
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.list import OneLineListItem
from kivymd.uix.label import MDLabel

from core.routine_engine import RoutineEngine
from ui.components.header import ScreenHeader


class RoutineDetailScreen(MDScreen):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.routine = None

        root = BoxLayout(orientation="vertical")

        self.header = ScreenHeader("Rotina")
        root.add_widget(self.header)

        self.list = BoxLayout(
            orientation="vertical",
            spacing=dp(8),
            padding=dp(16)
        )

        self.empty_label = MDLabel(
            text="Nenhuma atividade na rotina",
            halign="center"
        )

        root.add_widget(self.list)

        buttons = BoxLayout(
            orientation="horizontal",
            size_hint_y=None,
            height=dp(48),
            spacing=dp(12),
            padding=dp(16)
        )

        add_btn = MDRaisedButton(
            text="Adicionar bloco",
            on_release=lambda x: self.add_block()
        )
        autofill_btn = MDFlatButton(
            text="Auto preencher",
            on_release=lambda x: self.autofill()
        )

        buttons.add_widget(add_btn)
        buttons.add_widget(autofill_btn)

        root.add_widget(buttons)
        self.add_widget(root)

    # -----------------------
    # Lifecycle
    # -----------------------

    def load_routine(self, routine):
        self.routine = routine
        self.header.set_title(routine["period"])
        self.refresh()

    def on_pre_enter(self):
        # ESSENCIAL: sempre recarrega ao voltar
        if self.routine:
            self.refresh()

    # -----------------------
    # UI
    # -----------------------

    def refresh(self):
        self.list.clear_widgets()

        blocks = RoutineEngine.list_blocks(self.routine["id"])

        if not blocks:
            self.list.add_widget(self.empty_label)
            return

        for block in blocks:
            item = OneLineListItem(
                text=f"{block['title']} — {block['duration']} min"
            )
            self.list.add_widget(item)

    # -----------------------
    # Navigation
    # -----------------------

    def add_block(self):
        screen = self.manager.get_screen("add_routine_block")
        screen.set_routine(self.routine)
        self.manager.current = "add_routine_block"

    def autofill(self):
        if not self.routine:
            return
        RoutineEngine.autofill_blocks(self.routine["id"])
        self.refresh()
