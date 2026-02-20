from kivy.metrics import dp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDIconButton
from kivymd.uix.tooltip import MDTooltip


class BottomBarIcon(MDIconButton, MDTooltip):
    pass


class BottomBar(MDBoxLayout):
    def __init__(self, screen_manager, **kwargs):
        super().__init__(**kwargs)

        self.orientation = "horizontal"
        self.adaptive_height = True
        self.padding = [dp(12), dp(8)]
        self.spacing = dp(8)
        self.md_bg_color = (0.96, 0.96, 0.98, 1)

        self.sm = screen_manager

        self.add_widget(self._btn("view-dashboard-outline", "dashboard", "Dashboard"))
        self.add_widget(self._btn("chart-line", "stats", "Analytics"))
        self.add_widget(self._btn("calendar-today", "home", "Hoje"))
        self.add_widget(self._btn("clock-outline", "routine", "Rotinas"))
        self.add_widget(self._btn("format-list-bulleted", "activities", "Atividades"))
        self.add_widget(self._btn("shape-outline", "types", "Tipos"))
        self.add_widget(self._btn("target", "goals", "Metas"))
        self.add_widget(self._btn("book-open-page-variant", "books", "Livros"))
        self.add_widget(self._btn("cart-outline", "shopping", "Compras"))
        self.add_widget(self._btn("palette-outline", "paintings", "Pinturas"))
        self.add_widget(self._btn("account", "profile", "Perfil"))
        self.add_widget(self._btn("cog-outline", "settings", "Configurações"))

    def _btn(self, icon, screen, tooltip):
        return BottomBarIcon(
            icon=icon,
            tooltip_text=tooltip,
            on_release=lambda x: self._go(screen)
        )

    def _go(self, screen_name):
        if self.sm.current != screen_name:
            self.sm.current = screen_name
