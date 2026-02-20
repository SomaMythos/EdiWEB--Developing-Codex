"""
Shopping Screen - Sistema de Compras
"""

from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.dialog import MDDialog
from kivymd.uix.label import MDLabel
from kivymd.uix.card import MDCard
from kivy.metrics import dp

from core.shopping_engine import ShoppingEngine
from ui.components.header import ScreenHeader


class ShoppingScreen(MDScreen):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.wishlist_sort = "name"
        self.wishlist_filter = ""
        self.products_filter = ""

    def on_enter(self):
        self.load_items()

    def load_items(self):
        self.clear_widgets()

        root = MDBoxLayout(orientation="vertical", padding=dp(20), spacing=dp(15))

        root.add_widget(ScreenHeader("Compras"))

        scroll = MDScrollView()
        container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True
        )

        alert_items = ShoppingEngine.get_items_near_restock()
        if alert_items:
            alert_text = "\n".join(
                f"• {item['name']} (faltam {max(item.get('restock_days', 0) - item.get('days_since_restock', 0), 0)} dia(s))"
                for item in alert_items
            )
            alert_card = self.create_card(
                title="Itens perto de acabar",
                content=alert_text,
                color=(0.95, 0.56, 0.33, 1)
            )
            container.add_widget(alert_card)

        wishlist_section = self.build_section_header("Wishlist")
        container.add_widget(wishlist_section)
        container.add_widget(self.build_wishlist_filters())

        wishlist_items = ShoppingEngine.list_wish_items(
            item_type=self.wishlist_filter or None,
            order_by=self.wishlist_sort
        )

        if wishlist_items:
            for item in wishlist_items:
                container.add_widget(self.create_wishlist_card(item))
        else:
            container.add_widget(
                MDLabel(
                    text="Nenhum item na wishlist.",
                    halign="center",
                    size_hint_y=None,
                    height=dp(30)
                )
            )

        wishlist_btn_box = MDBoxLayout(
            spacing=dp(10),
            size_hint_y=None,
            height=dp(50)
        )
        wishlist_btn_box.add_widget(
            MDRaisedButton(
                text="Adicionar desejo",
                on_release=lambda x: self.open_add_wishlist_dialog()
            )
        )
        container.add_widget(wishlist_btn_box)

        products_section = self.build_section_header("Produtos")
        container.add_widget(products_section)
        container.add_widget(self.build_products_filters())

        items = ShoppingEngine.list_items_with_status(
            category=self.products_filter or None
        )

        if items:
            for item in items:
                container.add_widget(self.create_product_card(item))
        else:
            no_items = MDLabel(
                text="Nenhum produto cadastrado.",
                halign="center",
                size_hint_y=None,
                height=dp(30)
            )
            container.add_widget(no_items)

        products_btn_box = MDBoxLayout(
            spacing=dp(10),
            size_hint_y=None,
            height=dp(50)
        )

        products_btn_box.add_widget(
            MDRaisedButton(
                text="Adicionar produto",
                on_release=lambda x: self.open_add_dialog()
            )
        )

        container.add_widget(products_btn_box)

        scroll.add_widget(container)
        root.add_widget(scroll)

        self.add_widget(root)

    def build_section_header(self, title):
        return MDLabel(
            text=title,
            halign="left",
            font_style="H6",
            size_hint_y=None,
            height=dp(30)
        )

    def build_wishlist_filters(self):
        filter_box = MDBoxLayout(
            spacing=dp(10),
            size_hint_y=None,
            height=dp(60)
        )

        self.wishlist_filter_input = MDTextField(
            hint_text="Filtrar por tipo",
            mode="rectangle",
            text=self.wishlist_filter
        )

        filter_box.add_widget(self.wishlist_filter_input)
        filter_box.add_widget(
            MDFlatButton(
                text="Filtrar",
                on_release=lambda x: self.apply_wishlist_filter()
            )
        )
        filter_box.add_widget(
            MDFlatButton(
                text="Ordenar A-Z",
                on_release=lambda x: self.set_wishlist_sort("name")
            )
        )
        filter_box.add_widget(
            MDFlatButton(
                text="Ordenar Preço",
                on_release=lambda x: self.set_wishlist_sort("price")
            )
        )
        return filter_box

    def build_products_filters(self):
        filter_box = MDBoxLayout(
            spacing=dp(10),
            size_hint_y=None,
            height=dp(60)
        )

        self.products_filter_input = MDTextField(
            hint_text="Filtrar por tipo",
            mode="rectangle",
            text=self.products_filter
        )

        filter_box.add_widget(self.products_filter_input)
        filter_box.add_widget(
            MDFlatButton(
                text="Filtrar",
                on_release=lambda x: self.apply_products_filter()
            )
        )
        return filter_box

    def create_card(self, title, content, color):
        card = MDCard(
            orientation="vertical",
            padding=dp(12),
            spacing=dp(8),
            size_hint_y=None,
            adaptive_height=True,
            md_bg_color=color,
            radius=[12, 12, 12, 12]
        )

        card.add_widget(
            MDLabel(
                text=title,
                font_style="Subtitle1",
                halign="center",
                bold=True,
                size_hint_y=None,
                height=dp(24)
            )
        )

        card.add_widget(
            MDLabel(
                text=content,
                font_style="Body1",
                halign="center",
                size_hint_y=None,
                height=dp(60)
            )
        )

        return card

    def create_wishlist_card(self, item):
        card = MDCard(
            orientation="vertical",
            padding=dp(10),
            spacing=dp(6),
            size_hint_y=None,
            adaptive_height=True,
            radius=[12, 12, 12, 12]
        )

        info_parts = []
        if item.get("price"):
            info_parts.append(f"R$ {item['price']:.2f}")
        if item.get("item_type"):
            info_parts.append(item["item_type"])
        if item.get("link"):
            info_parts.append(f"Link: {item['link']}")

        card.add_widget(
            MDLabel(
                text=item.get("name", ""),
                font_style="Subtitle1",
                size_hint_y=None,
                height=dp(24)
            )
        )
        card.add_widget(
            MDLabel(
                text=" | ".join(info_parts) if info_parts else "Sem detalhes",
                font_style="Body2",
                size_hint_y=None,
                height=dp(20)
            )
        )

        action_box = MDBoxLayout(
            spacing=dp(10),
            size_hint_y=None,
            height=dp(36)
        )
        action_box.add_widget(
            MDFlatButton(
                text="Excluir",
                on_release=lambda x, item_id=item["id"]: self.delete_wish_item(item_id)
            )
        )
        card.add_widget(action_box)

        return card

    def create_product_card(self, item):
        card = MDCard(
            orientation="vertical",
            padding=dp(10),
            spacing=dp(6),
            size_hint_y=None,
            adaptive_height=True,
            radius=[12, 12, 12, 12]
        )

        price = item.get("average_price") or 0
        restock_days = item.get("restock_days") or 0
        status = item.get("restock_status", "")
        days_since = item.get("days_since_restock", 0)

        info_text = (
            f"R$ {price:.2f} | {status} | "
            f"{days_since} dia(s) desde cadastro/reposição | "
            f"Reposição média: {restock_days} dias"
        )

        card.add_widget(
            MDLabel(
                text=item.get("name", ""),
                font_style="Subtitle1",
                size_hint_y=None,
                height=dp(24)
            )
        )
        card.add_widget(
            MDLabel(
                text=info_text,
                font_style="Body2",
                size_hint_y=None,
                height=dp(40)
            )
        )

        action_box = MDBoxLayout(
            spacing=dp(10),
            size_hint_y=None,
            height=dp(36)
        )
        action_box.add_widget(
            MDFlatButton(
                text="Repor",
                on_release=lambda x, item_id=item["id"]: self.restock_item(item_id)
            )
        )
        action_box.add_widget(
            MDFlatButton(
                text="Excluir",
                on_release=lambda x, item_id=item["id"]: self.delete_product_item(item_id)
            )
        )
        card.add_widget(action_box)

        return card

    def apply_wishlist_filter(self):
        self.wishlist_filter = self.wishlist_filter_input.text.strip()
        self.load_items()

    def apply_products_filter(self):
        self.products_filter = self.products_filter_input.text.strip()
        self.load_items()

    def set_wishlist_sort(self, order_by):
        self.wishlist_sort = order_by
        self.load_items()

    def open_add_wishlist_dialog(self):
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True
        )

        self.wish_name_input = MDTextField(hint_text="Nome", mode="rectangle")
        self.wish_price_input = MDTextField(hint_text="Preço", mode="rectangle", input_filter="float")
        self.wish_link_input = MDTextField(hint_text="Link", mode="rectangle")
        self.wish_type_input = MDTextField(hint_text="Tipo", mode="rectangle")

        content.add_widget(self.wish_name_input)
        content.add_widget(self.wish_price_input)
        content.add_widget(self.wish_link_input)
        content.add_widget(self.wish_type_input)

        self.dialog = MDDialog(
            title="Adicionar à Wishlist",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: self.dialog.dismiss()),
                MDFlatButton(text="Adicionar", on_release=lambda x: self.add_wishlist_item()),
            ],
        )
        self.dialog.open()

    def add_wishlist_item(self):
        name = self.wish_name_input.text.strip()
        price = float(self.wish_price_input.text) if self.wish_price_input.text else None
        link = self.wish_link_input.text.strip() or None
        item_type = self.wish_type_input.text.strip() or None

        if name:
            ShoppingEngine.add_wish_item(
                name=name,
                price=price,
                link=link,
                item_type=item_type
            )
            self.dialog.dismiss()
            self.load_items()

    def delete_wish_item(self, item_id):
        ShoppingEngine.delete_wish_item(item_id)
        self.load_items()

    def open_add_dialog(self):
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True
        )

        self.name_input = MDTextField(hint_text="Nome do Item", mode="rectangle")
        self.price_input = MDTextField(hint_text="Preço Médio", mode="rectangle", input_filter="float")
        self.days_input = MDTextField(hint_text="Dias para Reposição", mode="rectangle", input_filter="int")
        self.type_input = MDTextField(hint_text="Tipo", mode="rectangle")

        content.add_widget(self.name_input)
        content.add_widget(self.price_input)
        content.add_widget(self.days_input)
        content.add_widget(self.type_input)

        self.dialog = MDDialog(
            title="Adicionar Produto",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(text="Cancelar", on_release=lambda x: self.dialog.dismiss()),
                MDFlatButton(text="Adicionar", on_release=lambda x: self.add_item()),
            ],
        )
        self.dialog.open()

    def add_item(self):
        name = self.name_input.text.strip()
        price = float(self.price_input.text) if self.price_input.text else 0
        days = int(self.days_input.text) if self.days_input.text else 30
        category = self.type_input.text.strip() or "geral"

        if name and price >= 0:
            ShoppingEngine.add_item(
                name=name,
                category=category,
                average_price=price,
                restock_days=days
            )
            self.dialog.dismiss()
            self.load_items()

    def delete_product_item(self, item_id):
        ShoppingEngine.delete_item(item_id)
        self.load_items()

    def restock_item(self, item_id):
        ShoppingEngine.record_restock(item_id)
        self.load_items()
