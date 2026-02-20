from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.menu import MDDropdownMenu
from kivymd.uix.textfield import MDTextField
from kivymd.uix.button import MDRaisedButton

from ui.components.header import ScreenHeader
from core.activity_engine import ActivityEngine
from core.routine_engine import RoutineEngine


class RoutineAddActivityScreen(MDScreen):
    def __init__(self, routine_block_id=None, **kwargs):
        super().__init__(**kwargs)

        self.name = "routine_add_activity"
        self.routine_block_id = routine_block_id
        self.selected_activity = None
        self.menu = None

        root = MDBoxLayout(orientation="vertical")

        # Header
        root.add_widget(ScreenHeader("Adicionar atividade"))

        content = MDBoxLayout(
            orientation="vertical",
            padding="16dp",
            spacing="16dp"
        )

        # Campo de atividade (dropdown)
        self.activity_field = MDTextField(
            hint_text="Atividade",
            readonly=True
        )
        self.activity_field.bind(on_touch_down=self.open_activity_menu)
        content.add_widget(self.activity_field)

        # Duração (override opcional)
        self.duration_field = MDTextField(
            hint_text="Duração (minutos)",
            input_filter="int"
        )
        content.add_widget(self.duration_field)

        # Botão salvar
        save_btn = MDRaisedButton(
            text="Salvar",
            pos_hint={"center_x": 0.5},
            on_release=self.save
        )
        content.add_widget(save_btn)

        root.add_widget(content)
        self.add_widget(root)

        self.load_activities()

    # -------------------------
    # Dropdown
    # -------------------------

    def load_activities(self):
        self.activities = ActivityEngine.list_activities()
        items = []

        for act in self.activities:
            items.append({
                "text": act["title"],
                "on_release": lambda x=act: self.select_activity(x)
            })

        self.menu = MDDropdownMenu(
            caller=self.activity_field,
            items=items,
        )

    def open_activity_menu(self, instance, touch):
        if instance.collide_point(*touch.pos) and self.menu:
            self.menu.open()
            return True
        return False

    def select_activity(self, activity):
        self.selected_activity = activity
        self.activity_field.text = activity["title"]

        estimated = activity["estimated_time"]
        if estimated:
            self.duration_field.text = str(estimated)

        self.menu.dismiss()

    # -------------------------
    # Salvar
    # -------------------------

    def save(self, *args):
        if not self.selected_activity:
            return

        try:
            duration = int(self.duration_field.text)
        except (ValueError, TypeError):
            duration = self.selected_activity["estimated_time"] or 0

        RoutineEngine.add_activity_to_block(
            block_id=self.routine_block_id,
            activity_id=self.selected_activity["id"],
            duration=duration
        )

        self.manager.current = "routine"
