"""
Paintings Screen - Gerenciamento de Pinturas
"""

from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.list import TwoLineIconListItem, IconLeftWidget, TwoLineAvatarListItem, ImageLeftWidget
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.dialog import MDDialog
from kivymd.uix.label import MDLabel
from kivy.uix.filechooser import FileChooserListView
from kivy.uix.image import Image
from kivy.metrics import dp
from datetime import datetime
import os

from core.painting_engine import PaintingEngine
from ui.components.header import ScreenHeader


class PaintingsScreen(MDScreen):

    def on_enter(self):
        self.load_paintings()

    def load_paintings(self):
        self.clear_widgets()

        root = MDBoxLayout(orientation="vertical", padding=dp(20), spacing=dp(15))
        root.add_widget(ScreenHeader("Pinturas"))

        scroll = MDScrollView()
        self.paintings_container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(10),
            adaptive_height=True,
        )

        paintings = PaintingEngine.list_paintings()

        if paintings:
            for painting in paintings:
                progress = PaintingEngine.get_progress(painting["id"])
                percentage = progress["percentage"] if progress else 0
                status = painting["status"]

                item = TwoLineIconListItem(
                    text=painting["title"],
                    secondary_text=f"{percentage}% - {status}",
                    on_release=lambda x, p=painting: self.open_detail(p),
                )

                icon = IconLeftWidget(
                    icon="palette" if status != "concluído" else "palette-swatch",
                )
                item.add_widget(icon)
                self.paintings_container.add_widget(item)
        else:
            self.paintings_container.add_widget(
                MDLabel(
                    text="Nenhuma pintura cadastrada.\nAdicione sua primeira obra!",
                    halign="center",
                )
            )

        scroll.add_widget(self.paintings_container)
        root.add_widget(scroll)

        add_btn = MDRaisedButton(
            text="Adicionar Pintura",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.open_add_dialog(),
        )
        root.add_widget(add_btn)

        self.add_widget(root)

    def open_add_dialog(self):
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True,
        )

        self.title_input = MDTextField(hint_text="Nome da pintura", mode="rectangle")
        self.size_input = MDTextField(hint_text="Tamanho (ex: 30x40 cm)", mode="rectangle")
        self.estimate_input = MDTextField(
            hint_text="Tempo estimado (min) (opcional)",
            mode="rectangle",
            input_filter="int",
        )

        content.add_widget(self.title_input)
        content.add_widget(self.size_input)
        content.add_widget(self.estimate_input)

        self.dialog = MDDialog(
            title="Adicionar Pintura",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: self.dialog.dismiss()),
                MDFlatButton(text="Adicionar", on_release=lambda x: self.add_painting()),
            ],
        )
        self.dialog.open()

    def add_painting(self):
        title = self.title_input.text.strip()
        size = self.size_input.text.strip() or None
        estimate = int(self.estimate_input.text) if self.estimate_input.text else None

        if title:
            PaintingEngine.create_painting(
                title=title,
                size=size,
                estimated_time=estimate,
            )
            self.dialog.dismiss()
            self.load_paintings()

    def open_detail(self, painting):
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True,
        )

        progress = PaintingEngine.get_progress(painting["id"]) or {}
        percentage = progress.get("percentage", 0)
        time_spent = progress.get("time_spent", 0)
        estimated_time = progress.get("estimated_time") or "N/A"
        size = painting.get("size") or "N/A"

        info = MDLabel(
            text=(
                f"{painting['title']}\n"
                f"Tamanho: {size}\n\n"
                f"Status: {painting['status']}\n"
                f"Progresso: {percentage}%\n"
                f"Tempo gasto: {time_spent} min\n"
                f"Tempo estimado: {estimated_time}"
            ),
            halign="center",
        )
        content.add_widget(info)

        self.time_input = MDTextField(
            hint_text="Minutos de progresso",
            mode="rectangle",
            input_filter="int",
        )
        self.notes_input = MDTextField(
            hint_text="Notas (opcional)",
            mode="rectangle",
        )
        content.add_widget(self.time_input)
        content.add_widget(self.notes_input)

        self.selected_photo_path = None
        select_photo_btn = MDFlatButton(
            text="Selecionar imagem",
            on_release=lambda x: self.open_file_picker(),
        )
        content.add_widget(select_photo_btn)

        history_label = MDLabel(
            text="Progressos recentes",
            halign="left",
            size_hint_y=None,
            height=dp(24),
        )
        content.add_widget(history_label)

        history_box = MDBoxLayout(
            orientation="vertical",
            spacing=dp(10),
            adaptive_height=True,
        )

        progress_entries = PaintingEngine.list_progress_entries(painting["id"])
        if progress_entries:
            for entry in progress_entries:
                photo_path = entry.get("photo_path") or ""
                timestamp = entry.get("timestamp") or ""
                formatted_date = self._format_timestamp(timestamp)
                time_spent_entry = entry.get("time_spent") or 0
                item = TwoLineAvatarListItem(
                    text=formatted_date,
                    secondary_text=f"{time_spent_entry} min",
                    on_release=lambda x, p=photo_path: self.open_image(p),
                )
                if photo_path and os.path.exists(photo_path):
                    item.add_widget(ImageLeftWidget(source=photo_path))
                else:
                    item.add_widget(IconLeftWidget(icon="image-off"))
                history_box.add_widget(item)
        else:
            history_box.add_widget(
                MDLabel(text="Nenhum progresso registrado.", halign="center")
            )

        content.add_widget(history_box)

        buttons = [
            MDFlatButton(text="Fechar", on_release=lambda x: self.dialog.dismiss()),
            MDFlatButton(
                text="Registrar Progresso",
                on_release=lambda x: self.register_progress(painting["id"]),
            ),
        ]

        if painting["status"] != "concluído":
            buttons.append(
                MDFlatButton(
                    text="Concluir",
                    on_release=lambda x: self.complete_painting(painting["id"]),
                )
            )

        self.dialog = MDDialog(
            title="Detalhes da Pintura",
            type="custom",
            content_cls=content,
            buttons=buttons,
        )
        self.dialog.open()

    def register_progress(self, painting_id):
        time_spent = int(self.time_input.text) if self.time_input.text else 0
        notes = self.notes_input.text.strip() or None
        photo_path = self.selected_photo_path or ""

        if time_spent > 0 or photo_path:
            PaintingEngine.register_progress(
                painting_id=painting_id,
                photo_path=photo_path,
                time_spent=time_spent,
                notes=notes,
            )
            self.dialog.dismiss()
            self.load_paintings()

    def open_file_picker(self):
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(10),
            size_hint_y=None,
            height=dp(320),
        )
        self.filechooser = FileChooserListView(
            filters=["*.png", "*.jpg", "*.jpeg", "*.gif", "*.bmp"],
            path=os.getcwd(),
            size_hint_y=None,
            height=dp(280),
        )
        content.add_widget(self.filechooser)

        self.file_dialog = MDDialog(
            title="Selecionar imagem",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: self.file_dialog.dismiss()),
                MDFlatButton(text="Selecionar", on_release=lambda x: self.confirm_file()),
            ],
        )
        self.file_dialog.open()

    def confirm_file(self):
        selection = self.filechooser.selection
        if selection:
            self.selected_photo_path = selection[0]
        self.file_dialog.dismiss()

    def open_image(self, photo_path):
        if not photo_path or not os.path.exists(photo_path):
            return
        image = Image(source=photo_path, allow_stretch=True, keep_ratio=True)
        self.image_dialog = MDDialog(
            title="Imagem do progresso",
            type="custom",
            content_cls=image,
            buttons=[
                MDFlatButton(text="Fechar", on_release=lambda x: self.image_dialog.dismiss()),
            ],
        )
        self.image_dialog.open()

    @staticmethod
    def _format_timestamp(timestamp):
        if not timestamp:
            return "Sem data"
        try:
            parsed = datetime.fromisoformat(timestamp)
            return parsed.strftime("%d/%m/%Y %H:%M")
        except ValueError:
            return timestamp

    def complete_painting(self, painting_id):
        PaintingEngine.complete_painting(painting_id)
        self.dialog.dismiss()
        self.load_paintings()
