from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDRaisedButton
from kivymd.uix.dialog import MDDialog
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.textfield import MDTextField
from kivymd.uix.menu import MDDropdownMenu
from kivymd.uix.label import MDLabel
from kivymd.uix.selectioncontrol import MDCheckbox
from kivy.metrics import dp

from core.export_engine import ExportEngine
from core.settings_engine import SettingsEngine
from ui.components.header import ScreenHeader


class SettingsScreen(MDScreen):

    def on_enter(self):
        self.clear_widgets()
        self.build_ui()

    def build_ui(self):
        layout = MDBoxLayout(orientation="vertical", padding=dp(16), spacing=dp(12))
        layout.add_widget(ScreenHeader("Configurações"))

        scroll = MDScrollView()
        content = MDBoxLayout(
            orientation="vertical",
            padding=dp(12),
            spacing=dp(12),
            adaptive_height=True,
        )

        self.wake_time_field = MDTextField(
            hint_text="Horário de acordar (HH:MM)",
            mode="rectangle",
            text=SettingsEngine.get_setting("wake_time", "07:00"),
        )
        self.sleep_time_field = MDTextField(
            hint_text="Horário de dormir (HH:MM)",
            mode="rectangle",
            text=SettingsEngine.get_setting("sleep_time", "22:00"),
        )
        self.suggest_role_field = MDTextField(
            hint_text="Filtro do sugerir atividade",
            mode="rectangle",
            readonly=True,
            text=SettingsEngine.get_setting("suggest_role", "qualquer"),
        )
        self.suggest_menu = MDDropdownMenu(
            caller=self.suggest_role_field,
            items=[
                {
                    "viewclass": "OneLineListItem",
                    "text": "qualquer",
                    "on_release": lambda: self.set_suggest_role("qualquer"),
                },
                {
                    "viewclass": "OneLineListItem",
                    "text": "atividade",
                    "on_release": lambda: self.set_suggest_role("atividade"),
                },
                {
                    "viewclass": "OneLineListItem",
                    "text": "rotina",
                    "on_release": lambda: self.set_suggest_role("rotina"),
                },
            ],
            width_mult=4,
        )
        self.suggest_role_field.bind(on_touch_down=self.open_suggest_menu)

        self.workday_checkboxes = {}
        work_days = SettingsEngine.get_work_days()
        workdays_label = MDLabel(
            text="Dias de trabalho",
            font_style="Caption",
            size_hint_y=None,
            height=dp(20),
        )

        day_options = [
            ("Segunda", 0),
            ("Terça", 1),
            ("Quarta", 2),
            ("Quinta", 3),
            ("Sexta", 4),
            ("Sábado", 5),
            ("Domingo", 6),
        ]
        day_rows = []
        for label, value in day_options:
            row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(8),
                size_hint_y=None,
                height=dp(32),
            )
            row.add_widget(MDLabel(text=label))
            checkbox = MDCheckbox(active=value in work_days)
            self.workday_checkboxes[value] = checkbox
            row.add_widget(checkbox)
            day_rows.append(row)

        self.fixed_rule_field = MDTextField(
            hint_text="Regra para atividades fixas",
            mode="rectangle",
            readonly=True,
            text=SettingsEngine.get_setting("fixed_rule", "todos_os_dias"),
        )
        self.fixed_rule_menu = MDDropdownMenu(
            caller=self.fixed_rule_field,
            items=[
                {
                    "viewclass": "OneLineListItem",
                    "text": "todos_os_dias",
                    "on_release": lambda: self.set_fixed_rule("todos_os_dias"),
                },
                {
                    "viewclass": "OneLineListItem",
                    "text": "somente_trabalho",
                    "on_release": lambda: self.set_fixed_rule("somente_trabalho"),
                },
                {
                    "viewclass": "OneLineListItem",
                    "text": "somente_folga",
                    "on_release": lambda: self.set_fixed_rule("somente_folga"),
                },
            ],
            width_mult=4,
        )
        self.fixed_rule_field.bind(on_touch_down=self.open_fixed_rule_menu)

        self.auto_suggest_rule_field = MDTextField(
            hint_text="Regra para auto-sugestão",
            mode="rectangle",
            readonly=True,
            text=SettingsEngine.get_setting("auto_suggest_rule", "primeiro_bloco"),
        )
        self.auto_suggest_rule_menu = MDDropdownMenu(
            caller=self.auto_suggest_rule_field,
            items=[
                {
                    "viewclass": "OneLineListItem",
                    "text": "primeiro_bloco",
                    "on_release": lambda: self.set_auto_suggest_rule("primeiro_bloco"),
                },
                {
                    "viewclass": "OneLineListItem",
                    "text": "bloco_aleatorio",
                    "on_release": lambda: self.set_auto_suggest_rule("bloco_aleatorio"),
                },
            ],
            width_mult=4,
        )
        self.auto_suggest_rule_field.bind(on_touch_down=self.open_auto_suggest_menu)

        save_settings_btn = MDRaisedButton(
            text="Salvar preferências",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.save_settings(),
        )

        export_json_btn = MDRaisedButton(
            text="Exportar Backup (JSON)",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.export_json()
        )

        export_csv_btn = MDRaisedButton(
            text="Exportar Dados (CSV)",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.export_csv()
        )

        content.add_widget(self.wake_time_field)
        content.add_widget(self.sleep_time_field)
        content.add_widget(self.suggest_role_field)
        content.add_widget(workdays_label)
        for row in day_rows:
            content.add_widget(row)
        content.add_widget(self.fixed_rule_field)
        content.add_widget(self.auto_suggest_rule_field)
        content.add_widget(save_settings_btn)
        content.add_widget(export_json_btn)
        content.add_widget(export_csv_btn)

        scroll.add_widget(content)
        layout.add_widget(scroll)
        self.add_widget(layout)

    def open_suggest_menu(self, instance, touch):
        if instance.collide_point(*touch.pos):
            self.suggest_menu.open()
        return False

    def open_fixed_rule_menu(self, instance, touch):
        if instance.collide_point(*touch.pos):
            self.fixed_rule_menu.open()
        return False

    def open_auto_suggest_menu(self, instance, touch):
        if instance.collide_point(*touch.pos):
            self.auto_suggest_rule_menu.open()
        return False

    def set_suggest_role(self, value):
        self.suggest_role_field.text = value
        self.suggest_menu.dismiss()

    def set_fixed_rule(self, value):
        self.fixed_rule_field.text = value
        self.fixed_rule_menu.dismiss()

    def set_auto_suggest_rule(self, value):
        self.auto_suggest_rule_field.text = value
        self.auto_suggest_rule_menu.dismiss()

    def save_settings(self):
        SettingsEngine.set_setting("wake_time", self.wake_time_field.text.strip())
        SettingsEngine.set_setting("sleep_time", self.sleep_time_field.text.strip())
        SettingsEngine.set_setting("suggest_role", self.suggest_role_field.text.strip())
        work_days = sorted(
            day for day, checkbox in self.workday_checkboxes.items() if checkbox.active
        )
        SettingsEngine.set_setting(
            "work_days",
            ",".join(str(day) for day in work_days),
        )
        SettingsEngine.set_setting("fixed_rule", self.fixed_rule_field.text.strip())
        SettingsEngine.set_setting(
            "auto_suggest_rule",
            self.auto_suggest_rule_field.text.strip(),
        )
        self.show_message("Preferências salvas com sucesso.")

    def export_json(self):
        path = ExportEngine.export_json()
        self.show_message(f"Backup JSON salvo em:\n{path}")

    def export_csv(self):
        files = ExportEngine.export_csv()
        if files:
            self.show_message("Arquivos CSV gerados:\n" + "\n".join(files))
        else:
            self.show_message("Nenhum dado para exportar.")

    def show_message(self, text):
        dialog = MDDialog(
            title="Exportação",
            text=text,
            buttons=[
                MDRaisedButton(
                    text="OK",
                    on_release=lambda x: dialog.dismiss()
                )
            ]
        )
        dialog.open()
