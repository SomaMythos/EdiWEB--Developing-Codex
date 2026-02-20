from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.list import MDList, OneLineListItem
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.scrollview import ScrollView

from ui.components.header import ScreenHeader
from core.routine_engine import RoutineEngine


class RoutineScreen(MDScreen):

    def on_enter(self):
        self.build_ui()

    def build_ui(self):
        self.clear_widgets()

        root = MDBoxLayout(orientation="vertical")

        root.add_widget(ScreenHeader("Rotinas"))

        scroll = ScrollView()
        self.list = MDList()
        scroll.add_widget(self.list)

        root.add_widget(scroll)

        create_btn = MDRaisedButton(
            text="Criar rotina",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.open_create()
        )

        root.add_widget(create_btn)
        self.add_widget(root)

        self.load_routines()

    def load_routines(self):
        self.list.clear_widgets()

        routines = RoutineEngine.list_routines()
        for r in routines:
            item = OneLineListItem(
                text=f"{r['period']} ({r['start']} - {r['end']})",
                on_release=lambda x, r=r: self.open_detail(r)
            )
            self.list.add_widget(item)

    def open_create(self):
        self.manager.current = "create_routine"

    def open_detail(self, routine):
        screen = self.manager.get_screen("routine_detail")
        screen.load_routine(routine)
        self.manager.current = "routine_detail"
