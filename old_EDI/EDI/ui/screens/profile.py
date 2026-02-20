from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.scrollview import MDScrollView
from kivy.metrics import dp
from kivymd.uix.textfield import MDTextField
from kivymd.uix.button import MDRaisedButton

from core.user_profile_engine import UserProfileEngine
from ui.components.header import ScreenHeader


class ProfileScreen(MDScreen):
    def on_enter(self):
        self.build_ui()
        self.load_profile()

    # -------------------------------------------------
    # UI
    # -------------------------------------------------

    def build_ui(self):
        self.clear_widgets()

        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(16),
            spacing=dp(12),
        )

        root.add_widget(ScreenHeader("Perfil"))

        scroll = MDScrollView()
        content = MDBoxLayout(
            orientation="vertical",
            padding=dp(12),
            spacing=dp(12),
            adaptive_height=True,
        )

        self.name_label = MDLabel(text="Nome: —")
        self.age_label = MDLabel(text="Idade: —")
        self.height_label = MDLabel(text="Altura: —")
        self.weight_label = MDLabel(text="Peso atual: —")
        self.bmi_label = MDLabel(text="IMC: —")

        content.add_widget(self.name_label)
        content.add_widget(self.age_label)
        content.add_widget(self.height_label)
        content.add_widget(self.weight_label)
        content.add_widget(self.bmi_label)

        self.weight_input = MDTextField(
            hint_text="Novo peso (kg)",
            input_filter="float",
        )

        save_btn = MDRaisedButton(
            text="Salvar peso",
            pos_hint={"center_x": 0.5},
            on_release=self.save_weight,
        )

        content.add_widget(self.weight_input)
        content.add_widget(save_btn)

        scroll.add_widget(content)
        root.add_widget(scroll)

        self.add_widget(root)

    # -------------------------------------------------
    # Dados
    # -------------------------------------------------

    def load_profile(self):
        try:
            profile = UserProfileEngine.get_profile()
            latest = UserProfileEngine.get_latest_metric()

            name = profile.get("name", "—")
            height = profile.get("height")
            age = UserProfileEngine.get_age(profile.get("birth_date"))
            weight = latest["weight"] if latest else None
            bmi = UserProfileEngine.calculate_bmi(weight, height)

            self.name_label.text = f"Nome: {name}"
            self.age_label.text = f"Idade: {age if age is not None else '—'}"
            self.height_label.text = f"Altura: {height} cm" if height else "Altura: —"
            self.weight_label.text = f"Peso atual: {weight} kg" if weight else "Peso atual: —"
            self.bmi_label.text = f"IMC: {bmi}" if bmi else "IMC: —"

        except Exception as e:
            self.name_label.text = "Erro ao carregar perfil"
            print("Erro ao carregar perfil:", e)

    # -------------------------------------------------
    # Ação
    # -------------------------------------------------

    def save_weight(self, *args):
        try:
            value = self.weight_input.text.strip()
            if not value:
                return

            weight = float(value)
            ok, _ = UserProfileEngine.add_metric(weight)

            if ok:
                self.weight_input.text = ""
                # ESSENCIAL: recarrega tudo
                self.load_profile()

        except Exception as e:
            print("Erro ao salvar peso:", e)
