"""
Books Screen - Gerenciamento de Livros
"""

from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.list import TwoLineIconListItem, IconLeftWidget
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.dialog import MDDialog
from kivymd.uix.label import MDLabel
from kivymd.uix.menu import MDDropdownMenu
from kivy.metrics import dp

from core.book_engine import BookEngine
from ui.components.header import ScreenHeader


class BooksScreen(MDScreen):

    STATUS_ORDER = ["Novo", "Iniciado", "Concluído"]
    TYPE_ORDER = ["livro", "hq", "manga"]
    
    def on_enter(self):
        self.load_books()
    
    def load_books(self):
        self.clear_widgets()
        
        root = MDBoxLayout(orientation="vertical", padding=dp(20), spacing=dp(15))
        
        root.add_widget(ScreenHeader("Livros"))
        
        # Lista de livros
        scroll = MDScrollView()
        self.books_container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(10),
            adaptive_height=True
        )
        
        books = BookEngine.list_books()

        if books:
            grouped = self.group_books(books)
            for status_label in self.STATUS_ORDER:
                type_groups = grouped.get(status_label, {})
                if not type_groups:
                    continue

                status_header = MDLabel(
                    text=status_label,
                    font_style="H6",
                    bold=True,
                    size_hint_y=None,
                    height=dp(28),
                )
                self.books_container.add_widget(status_header)

                for type_key in self.TYPE_ORDER:
                    type_books = type_groups.get(type_key, [])
                    if not type_books:
                        continue

                    type_header = MDLabel(
                        text=BookEngine.get_book_type_label(type_key),
                        font_style="Subtitle1",
                        size_hint_y=None,
                        height=dp(22),
                    )
                    self.books_container.add_widget(type_header)

                    for book in sorted(type_books, key=lambda b: b.get("title", "")):
                        progress = BookEngine.get_progress_percentage(book["id"])
                        status_icon = self.get_status_icon(status_label)

                        item = TwoLineIconListItem(
                            text=book["title"],
                            secondary_text=f"{progress}% - {book['current_page']}/{book['total_pages']} páginas",
                            on_release=lambda x, b=book: self.open_book_detail(b),
                        )

                        icon = IconLeftWidget(icon=status_icon)
                        item.add_widget(icon)

                        self.books_container.add_widget(item)
        else:
            no_books = MDLabel(
                text="Nenhum livro cadastrado.\nAdicione seu primeiro livro!",
                halign="center"
            )
            self.books_container.add_widget(no_books)
        
        scroll.add_widget(self.books_container)
        root.add_widget(scroll)
        
        # Botão adicionar
        add_btn = MDRaisedButton(
            text="Adicionar",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.open_add_dialog()
        )
        root.add_widget(add_btn)
        
        self.add_widget(root)
    
    def open_add_dialog(self):
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True
        )
        
        self.title_input = MDTextField(hint_text="Título", mode="rectangle")
        self.pages_input = MDTextField(hint_text="Total de Páginas", mode="rectangle", input_filter="int")
        self.type_input = MDTextField(hint_text="Tipo", mode="rectangle", readonly=True)
        self.book_type = "livro"
        self.type_input.text = BookEngine.get_book_type_label(self.book_type)
        self.type_input.bind(on_touch_down=self.open_type_menu)
        self.build_type_menu()
        
        content.add_widget(self.title_input)
        content.add_widget(self.type_input)
        content.add_widget(self.pages_input)
        
        self.dialog = MDDialog(
            title="Adicionar Livro",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: self.dialog.dismiss()),
                MDFlatButton(text="Adicionar", on_release=lambda x: self.add_book()),
            ],
        )
        self.dialog.open()
    
    def add_book(self):
        title = self.title_input.text.strip()
        pages = int(self.pages_input.text) if self.pages_input.text else 0
        
        if title and pages > 0:
            BookEngine.add_book(
                title=title,
                total_pages=pages,
                book_type=self.book_type,
            )
            self.dialog.dismiss()
            self.load_books()

    def build_type_menu(self):
        items = []
        for key in self.TYPE_ORDER:
            items.append(
                {
                    "viewclass": "OneLineListItem",
                    "text": BookEngine.get_book_type_label(key),
                    "on_release": lambda k=key: self.set_book_type(k),
                }
            )

        if getattr(self, "type_menu", None):
            self.type_menu.dismiss()

        self.type_menu = MDDropdownMenu(
            caller=self.type_input,
            items=items,
            width_mult=3,
        )

    def open_type_menu(self, instance, touch):
        if instance.collide_point(*touch.pos):
            if self.type_menu:
                self.type_menu.open()
        return False

    def set_book_type(self, book_type):
        self.book_type = book_type
        self.type_input.text = BookEngine.get_book_type_label(book_type)
        if self.type_menu:
            self.type_menu.dismiss()
    
    def open_book_detail(self, book):
        # Diálogo de detalhes do livro
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True
        )
        
        progress = BookEngine.get_progress_percentage(book["id"])
        
        info = MDLabel(
            text=f"{book['title']}\n\n"
                 f"Tipo: {BookEngine.get_book_type_label(book.get('book_type'))}\n"
                 f"Progresso: {progress}%\n"
                 f"Páginas: {book['current_page']}/{book['total_pages']}",
            halign="center"
        )
        content.add_widget(info)
        
        # Input para registrar páginas lidas
        self.pages_read_input = MDTextField(
            hint_text="Páginas lidas hoje",
            mode="rectangle",
            input_filter="int"
        )
        content.add_widget(self.pages_read_input)
        
        self.dialog = MDDialog(
            title="Detalhes do Livro",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(text="Fechar", on_release=lambda x: self.dialog.dismiss()),
                MDFlatButton(
                    text="Registrar Leitura",
                    on_release=lambda x: self.register_reading(book["id"])
                ),
            ],
        )
        self.dialog.open()
    
    def register_reading(self, book_id):
        pages = int(self.pages_read_input.text) if self.pages_read_input.text else 0
        if pages > 0:
            BookEngine.add_reading_session(book_id=book_id, pages_read=pages)
            self.dialog.dismiss()
            self.load_books()

    def group_books(self, books):
        grouped = {}
        for book in books:
            status_label = BookEngine.get_reading_status_label(book)
            type_key = BookEngine.normalize_book_type(book.get("book_type"))
            grouped.setdefault(status_label, {}).setdefault(type_key, []).append(book)
        return grouped

    def get_status_icon(self, status_label):
        if status_label == "Concluído":
            return "book-check"
        if status_label == "Iniciado":
            return "book-open"
        return "book-plus"
