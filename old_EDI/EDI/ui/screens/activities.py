from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.dialog import MDDialog
from kivymd.uix.textfield import MDTextField
from kivymd.uix.label import MDLabel
from kivy.metrics import dp

from core.activity_engine import ActivityEngine
from core.activity_type_engine import ActivityTypeEngine
from ui.components.header import ScreenHeader


class ActivitiesScreen(MDScreen):

    def on_enter(self):
        self.build_ui()

    def build_ui(self):
        self.clear_widgets()

        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(20),
            spacing=dp(16)
        )

        root.add_widget(ScreenHeader("Atividades"))

        self.list_container = MDBoxLayout(
            orientation="vertical",
            spacing=10,
            adaptive_height=True
        )

        scroll = MDScrollView()
        scroll.add_widget(self.list_container)

        add_btn = MDRaisedButton(
            text="Adicionar Atividade",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.open_add_dialog()
        )

        root.add_widget(scroll)
        root.add_widget(add_btn)

        self.add_widget(root)

        self.load_activities()

    def load_activities(self):
        self.list_container.clear_widgets()

        activities = ActivityEngine.list_activities()

        grouped = {}
        for activity in activities:
            grouped.setdefault(activity["type_title"], []).append(activity)

        for type_title in sorted(grouped.keys()):
            self.list_container.add_widget(
                MDLabel(
                    text=type_title,
                    theme_text_color="Primary",
                    font_style="H6"
                )
            )

            for activity in grouped[type_title]:
                role_label = "Rotina" if activity["role"] == "rotina" else "Atividade"
                subtitle = f"{role_label}"
                if activity.get("estimated_time"):
                    subtitle += f" • {activity['estimated_time']} min"

                item = MDBoxLayout(
                    orientation="horizontal",
                    spacing=10,
                    adaptive_height=True
                )

                text_box = MDBoxLayout(
                    orientation="vertical",
                    adaptive_height=True
                )
                text_box.add_widget(
                    MDLabel(
                        text=activity["title"],
                        theme_text_color="Primary"
                    )
                )
                text_box.add_widget(
                    MDLabel(
                        text=subtitle,
                        theme_text_color="Secondary",
                        font_style="Caption"
                    )
                )

                actions = MDBoxLayout(
                    orientation="horizontal",
                    spacing=6,
                    adaptive_height=True,
                    size_hint=(None, None)
                )
                actions.width = dp(160)

                actions.add_widget(
                    MDFlatButton(
                        text="Editar",
                        on_release=lambda x, activity=activity: self.open_edit_dialog(activity)
                    )
                )
                actions.add_widget(
                    MDFlatButton(
                        text="Excluir",
                        on_release=lambda x, activity=activity: self.open_delete_dialog(activity)
                    )
                )

                item.add_widget(text_box)
                item.add_widget(actions)
                self.list_container.add_widget(item)

    def open_add_dialog(self):
        self.selected_type_id = None

        content = MDBoxLayout(
            orientation="vertical",
            spacing=15,
            adaptive_height=True
        )

        self.name_input = MDTextField(
            hint_text="Nome da atividade",
            mode="rectangle"
        )

        self.time_input = MDTextField(
            hint_text="Tempo estimado (min)",
            mode="rectangle",
            input_filter="int"
        )

        self.type_label = MDLabel(
            text="Selecione um tipo abaixo",
            halign="center",
            theme_text_color="Secondary"
        )

        content.add_widget(self.name_input)
        content.add_widget(self.time_input)
        content.add_widget(self.type_label)

        # botões de tipos
        types = ActivityTypeEngine.list_types()
        
        if not types or len(types) == 0:
            no_types = MDLabel(
                text="Crie tipos primeiro.\nVá na aba 'Tipos'",
                halign="center"
            )
            content.add_widget(no_types)
        else:
            for t in types:
                content.add_widget(
                    MDRaisedButton(
                        text=f"{t['title']} ({'Rotina' if t['role'] == 'rotina' else 'Atividade'})",
                        on_release=lambda x, t=t: self.set_type(t)
                    )
                )

        self.dialog = MDDialog(
            title="Nova Atividade",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(
                    text="Cancelar",
                    on_release=lambda x: self.dialog.dismiss()
                ),
                MDFlatButton(
                    text="Salvar",
                    on_release=lambda x: self.save_activity()
                ),
            ],
        )

        self.dialog.open()

    def set_type(self, type_row):
        self.selected_type_id = type_row["id"]
        self.type_label.text = type_row["title"]
        self.type_label.theme_text_color = "Primary"

    def save_activity(self):
        title = self.name_input.text.strip()
        
        if not title:
            print("Nome vazio")
            return
            
        if not self.selected_type_id:
            self.type_label.text = "Selecione um tipo."
            return

        time_text = self.time_input.text.strip()
        time = int(time_text) if time_text else None

        try:
            ActivityEngine.create_activity(
                title=title,
                type_id=self.selected_type_id,
                estimated_time=time
            )
            print(f"Atividade '{title}' criada!")
            self.dialog.dismiss()
            self.build_ui()
        except Exception as e:
            print(f"Erro: {e}")

    def open_edit_dialog(self, activity_row):
        self.edit_activity_id = activity_row["id"]
        self.selected_type_id = activity_row["type_id"]

        content = MDBoxLayout(
            orientation="vertical",
            spacing=15,
            adaptive_height=True
        )

        self.name_input = MDTextField(
            hint_text="Nome da atividade",
            text=activity_row["title"],
            mode="rectangle"
        )

        estimated_time = activity_row.get("estimated_time")
        self.time_input = MDTextField(
            hint_text="Tempo estimado (min)",
            text=str(estimated_time) if estimated_time is not None else "",
            mode="rectangle",
            input_filter="int"
        )

        self.type_label = MDLabel(
            text=activity_row["type_title"],
            halign="center",
            theme_text_color="Primary"
        )

        content.add_widget(self.name_input)
        content.add_widget(self.time_input)
        content.add_widget(self.type_label)

        types = ActivityTypeEngine.list_types()

        if not types or len(types) == 0:
            no_types = MDLabel(
                text="Crie tipos primeiro.\nVá na aba 'Tipos'",
                halign="center"
            )
            content.add_widget(no_types)
        else:
            for t in types:
                content.add_widget(
                    MDRaisedButton(
                        text=f"{t['title']} ({'Rotina' if t['role'] == 'rotina' else 'Atividade'})",
                        on_release=lambda x, t=t: self.set_type(t)
                    )
                )

        self.dialog = MDDialog(
            title="Editar Atividade",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(
                    text="Cancelar",
                    on_release=lambda x: self.dialog.dismiss()
                ),
                MDFlatButton(
                    text="Salvar",
                    on_release=lambda x: self.save_activity_update()
                ),
            ],
        )

        self.dialog.open()

    def save_activity_update(self):
        title = self.name_input.text.strip()

        if not title:
            print("Nome vazio")
            return

        if not self.selected_type_id:
            self.type_label.text = "Selecione um tipo."
            return

        time_text = self.time_input.text.strip()
        time = int(time_text) if time_text else None

        try:
            ActivityEngine.update_activity(
                self.edit_activity_id,
                title=title,
                type_id=self.selected_type_id,
                estimated_time=time
            )
            print(f"Atividade '{title}' atualizada!")
            self.dialog.dismiss()
            self.build_ui()
        except Exception as e:
            print(f"Erro: {e}")

    def open_delete_dialog(self, activity_row):
        self.delete_activity_id = activity_row["id"]
        dialog = MDDialog(
            title="Excluir Atividade",
            text=f"Tem certeza que deseja excluir '{activity_row['title']}'?",
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: dialog.dismiss()),
                MDFlatButton(text="Excluir", on_release=lambda x: self.confirm_delete(dialog)),
            ],
        )
        dialog.open()

    def confirm_delete(self, dialog):
        ActivityEngine.delete_activity(self.delete_activity_id)
        dialog.dismiss()
        self.build_ui()
