from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.dialog import MDDialog
from kivymd.uix.textfield import MDTextField
from kivymd.uix.label import MDLabel
from kivy.metrics import dp

from core.activity_type_engine import ActivityTypeEngine
from ui.components.header import ScreenHeader


class ActivityTypesScreen(MDScreen):

    def on_enter(self):
        self.build_ui()

    def build_ui(self):
        self.clear_widgets()

        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(20),
            spacing=dp(16)
        )

        root.add_widget(ScreenHeader("Tipos de Atividade"))

        self.list_container = MDBoxLayout(
            orientation="vertical",
            spacing=10,
            adaptive_height=True
        )

        scroll = MDScrollView()
        scroll.add_widget(self.list_container)

        add_btn = MDRaisedButton(
            text="Adicionar Tipo",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.open_add_dialog()
        )

        root.add_widget(scroll)
        root.add_widget(add_btn)

        self.add_widget(root)
        self.load_types()

    def load_types(self):
        self.list_container.clear_widgets()

        types = ActivityTypeEngine.list_types()

        for t in types:
            label = "Rotina" if t["role"] == "rotina" else "Atividade"
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
                    text=t["title"],
                    theme_text_color="Primary"
                )
            )
            text_box.add_widget(
                MDLabel(
                    text=label,
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
                    on_release=lambda x, t=t: self.open_edit_dialog(t)
                )
            )
            actions.add_widget(
                MDFlatButton(
                    text="Excluir",
                    on_release=lambda x, t=t: self.open_delete_dialog(t)
                )
            )

            item.add_widget(text_box)
            item.add_widget(actions)
            self.list_container.add_widget(item)

    # ----------------------------
    # DIÁLOGO NOVO TIPO
    # ----------------------------

    def open_add_dialog(self):
        self.selected_role = "atividade"

        content = MDBoxLayout(
            orientation="vertical",
            spacing=15,
            adaptive_height=True
        )

        self.name_input = MDTextField(
            hint_text="Nome do tipo",
            mode="rectangle"
        )

        self.role_label = MDLabel(
            text="Papel: Atividade",
            halign="center"
        )

        role_buttons = MDBoxLayout(spacing=10, adaptive_height=True)

        role_buttons.add_widget(
            MDRaisedButton(text="Rotina", on_release=lambda x: self.set_role("rotina"))
        )
        role_buttons.add_widget(
            MDRaisedButton(text="Atividade", on_release=lambda x: self.set_role("atividade"))
        )

        content.add_widget(self.name_input)
        content.add_widget(MDLabel(text="Papel no dia"))
        content.add_widget(role_buttons)
        content.add_widget(self.role_label)

        self.dialog = MDDialog(
            title="Novo Tipo",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: self.dialog.dismiss()),
                MDFlatButton(text="Salvar", on_release=lambda x: self.save_type()),
            ],
        )

        self.dialog.open()

    def set_role(self, role):
        self.selected_role = role
        label = "Rotina" if role == "rotina" else "Atividade"
        self.role_label.text = f"Papel: {label}"

    def save_type(self):
        title = self.name_input.text.strip()
        if not title:
            return

        ActivityTypeEngine.create_type(title, self.selected_role)

        self.dialog.dismiss()
        self.on_enter()

    # ----------------------------
    # DIÁLOGO EDITAR TIPO
    # ----------------------------

    def open_edit_dialog(self, type_row):
        self.edit_type_id = type_row["id"]
        self.selected_role = type_row["role"]

        content = MDBoxLayout(
            orientation="vertical",
            spacing=15,
            adaptive_height=True
        )

        self.name_input = MDTextField(
            hint_text="Nome do tipo",
            text=type_row["title"],
            mode="rectangle"
        )

        label = "Rotina" if self.selected_role == "rotina" else "Atividade"
        self.role_label = MDLabel(
            text=f"Papel: {label}",
            halign="center"
        )

        role_buttons = MDBoxLayout(spacing=10, adaptive_height=True)
        role_buttons.add_widget(
            MDRaisedButton(text="Rotina", on_release=lambda x: self.set_role("rotina"))
        )
        role_buttons.add_widget(
            MDRaisedButton(text="Atividade", on_release=lambda x: self.set_role("atividade"))
        )

        content.add_widget(self.name_input)
        content.add_widget(MDLabel(text="Papel no dia"))
        content.add_widget(role_buttons)
        content.add_widget(self.role_label)

        self.dialog = MDDialog(
            title="Editar Tipo",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: self.dialog.dismiss()),
                MDFlatButton(text="Salvar", on_release=lambda x: self.save_type_update()),
            ],
        )

        self.dialog.open()

    def save_type_update(self):
        title = self.name_input.text.strip()
        if not title:
            return

        ActivityTypeEngine.update_type(
            self.edit_type_id,
            title=title,
            role=self.selected_role
        )

        self.dialog.dismiss()
        self.on_enter()

    # ----------------------------
    # DIÁLOGO EXCLUIR TIPO
    # ----------------------------

    def open_delete_dialog(self, type_row):
        self.delete_type_id = type_row["id"]
        dialog = MDDialog(
            title="Excluir Tipo",
            text=f"Tem certeza que deseja excluir '{type_row['title']}'?",
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: dialog.dismiss()),
                MDFlatButton(text="Excluir", on_release=lambda x: self.confirm_delete(dialog)),
            ],
        )
        dialog.open()

    def confirm_delete(self, dialog):
        ActivityTypeEngine.delete_type(self.delete_type_id)
        dialog.dismiss()
        self.on_enter()
