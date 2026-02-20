from kivymd.uix.bottomnavigation import MDBottomNavigation, MDBottomNavigationItem


class BottomNav(MDBottomNavigation):
    def __init__(self, screen_manager, **kwargs):
        super().__init__(**kwargs)

        self.screen_manager = screen_manager

        self.size_hint_y = None
        self.height = "64dp"

        self._build_tabs()

    def _build_tabs(self):
        self.add_widget(self._tab("home", "Hoje", "calendar-today"))
        self.add_widget(self._tab("routine", "Rotina", "clock-outline"))
        self.add_widget(self._tab("activities", "Atividades", "format-list-bulleted"))
        self.add_widget(self._tab("types", "Tipos", "shape-outline"))
        self.add_widget(self._tab("goals", "Metas", "target"))

    def _tab(self, name, text, icon):
        tab = MDBottomNavigationItem(
            name=name,
            text=text,
            icon=icon,
        )
        tab.bind(on_release=lambda *_: self._go(name))
        return tab

    def _go(self, screen_name):
        if self.screen_manager.current != screen_name:
            self.screen_manager.current = screen_name
