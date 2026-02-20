from kivy.uix.boxlayout import BoxLayout
from kivy.metrics import dp

from kivymd.uix.screen import MDScreen
from kivymd.uix.textfield import MDTextField
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.menu import MDDropdownMenu
from kivymd.uix.list import OneLineListItem
from kivymd.uix.selectioncontrol import MDCheckbox
from kivymd.uix.label import MDLabel

from core.activity_engine import ActivityEngine
from core.routine_engine import RoutineEngine
from ui.components.header import ScreenHeader


class AddRoutineBlockScreen(MDScreen):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.routine = None
        self.activities = []
        self.menu = None
        self.selected_activity = None
        self.is_free_block = False
        self.allow_autofill = True

        root = BoxLayout(orientation="vertical")
        root.add_widget(ScreenHeader("Adicionar bloco"))

        content = BoxLayout(
            orientation="vertical",
            padding=dp(24),
            spacing=dp(20)
        )

        # ATIVIDADE (dropdown)
        self.activity_field = MDTextField(
            hint_text="Atividade",
            mode="rectangle",
            readonly=False
        )
        self.activity_field.bind(on_touch_down=self.open_menu)

        # DURAÇÃO
        self.duration_field = MDTextField(
            hint_text="Duração (minutos)",
            mode="rectangle",
            input_filter="int"
        )

        options = BoxLayout(
            orientation="vertical",
            spacing=dp(12),
            size_hint_y=None,
            height=dp(100)
        )

        free_row = BoxLayout(
            orientation="horizontal",
            size_hint_y=None,
            height=dp(40)
        )
        free_row.add_widget(MDLabel(text="Bloco livre (sem atividade)"))
        self.free_checkbox = MDCheckbox(active=False)
        self.free_checkbox.bind(active=self.set_free_block)
        free_row.add_widget(self.free_checkbox)

        autofill_row = BoxLayout(
            orientation="horizontal",
            size_hint_y=None,
            height=dp(40)
        )
        autofill_row.add_widget(MDLabel(text="Permitir auto preenchimento"))
        self.autofill_checkbox = MDCheckbox(active=True)
        self.autofill_checkbox.bind(active=self.set_autofill_allowed)
        autofill_row.add_widget(self.autofill_checkbox)

        options.add_widget(free_row)
        options.add_widget(autofill_row)

        save_btn = MDRaisedButton(
            text="Salvar",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.save()
        )

        content.add_widget(self.activity_field)
        content.add_widget(self.duration_field)
        content.add_widget(options)
        content.add_widget(save_btn)

        root.add_widget(content)
        self.add_widget(root)

    # -----------------------
    # Lifecycle
    # -----------------------

    def on_pre_enter(self):
        self.load_activities()

    def set_routine(self, routine):
        self.routine = routine

    # -----------------------
    # Dropdown
    # -----------------------

    def load_activities(self):
        self.activities = ActivityEngine.list_activities()

        items = []
        for activity in self.activities:
            items.append({
                "viewclass": "OneLineListItem",
                "text": activity["title"],
                "on_release": lambda a=activity: self.select_activity(a)
            })

        if self.menu:
            self.menu.dismiss()

        self.menu = MDDropdownMenu(
            caller=self.activity_field,
            items=items,
            width_mult=4
        )

    def open_menu(self, instance, touch):
        if self.is_free_block:
            return False
        if instance.collide_point(*touch.pos):
            if self.menu:
                self.menu.open()
        return False

    def select_activity(self, activity):
        self.selected_activity = activity
        self.activity_field.text = activity["title"]

        if activity.get("estimated_time"):
            self.duration_field.text = str(activity["estimated_time"])
        else:
            self.duration_field.text = ""

        self.menu.dismiss()

    def set_free_block(self, _instance, value):
        self.is_free_block = value
        if value:
            self.activity_field.text = ""
            self.selected_activity = None

    def set_autofill_allowed(self, _instance, value):
        self.allow_autofill = value

    # -----------------------
    # Save
    # -----------------------

    def save(self):
        if not self.routine:
            return

        if not self.is_free_block and not self.selected_activity:
            return

        if not self.duration_field.text:
            return

        RoutineEngine.add_block(
            routine_id=self.routine["id"],
            activity_id=self.selected_activity["id"] if self.selected_activity else None,
            duration=int(self.duration_field.text),
            auto_fill_allowed=1 if self.allow_autofill else 0
        )

        self.manager.current = "routine_detail"
