from kivy.graphics import Color, Rectangle
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel


class Separator(Widget):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.size_hint_y = None
        self.height = dp(1)
        with self.canvas:
            self._color = Color(0.85, 0.85, 0.88, 1)
            self._rect = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._update_rect, size=self._update_rect)

    def _update_rect(self, *_args):
        self._rect.pos = self.pos
        self._rect.size = self.size


class ScreenHeader(MDBoxLayout):
    def __init__(self, title="", subtitle="", **kwargs):
        super().__init__(
            orientation="vertical",
            padding=[dp(16), dp(12), dp(16), dp(8)],
            spacing=dp(4),
            size_hint_y=None,
            adaptive_height=True,
            **kwargs,
        )
        self.md_bg_color = (0.98, 0.98, 0.99, 1)
        self.label = MDLabel(
            text=title,
            font_style="H5",
            halign="center",
            size_hint_y=None,
            height=dp(28),
            bold=True,
        )
        self.subtitle = MDLabel(
            text=subtitle,
            font_style="Caption",
            halign="center",
            theme_text_color="Secondary",
            size_hint_y=None,
            height=dp(18) if subtitle else dp(0),
        )
        self.add_widget(self.label)
        self.add_widget(self.subtitle)
        self.add_widget(Separator())

    def set_title(self, title):
        self.label.text = title

    def set_subtitle(self, subtitle):
        self.subtitle.text = subtitle
        self.subtitle.height = dp(18) if subtitle else dp(0)
