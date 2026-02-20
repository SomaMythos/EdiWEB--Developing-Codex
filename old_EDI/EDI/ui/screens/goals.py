from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.list import (
    MDList,
    ThreeLineAvatarIconListItem,
    IconLeftWidget,
    IconRightWidget,
)
from kivymd.uix.button import MDRaisedButton, MDFlatButton, MDIconButton
from kivymd.uix.dialog import MDDialog
from kivymd.uix.textfield import MDTextField
from kivymd.uix.label import MDLabel
from kivy.metrics import dp
from datetime import datetime

from core.goal_engine import GoalEngine
from ui.components.header import ScreenHeader


class GoalsScreen(MDScreen):

    def on_enter(self):
        self.build_ui()

    def build_ui(self):
        self.clear_widgets()

        root = MDBoxLayout(
            orientation="vertical",
            padding=dp(20),
            spacing=dp(20)
        )

        self.points_label = MDLabel(
            text="Pontos: 0",
            halign="center",
            font_style="Caption",
            size_hint_y=None,
            height=dp(18),
        )
        root.add_widget(ScreenHeader("Metas"))
        root.add_widget(self.points_label)

        self.list_container = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(12),
        )

        scroll = MDScrollView()
        scroll.add_widget(self.list_container)

        add_btn = MDRaisedButton(
            text="Nova Meta",
            pos_hint={"center_x": 0.5},
            on_release=lambda x: self.open_add_dialog()
        )

        root.add_widget(scroll)
        root.add_widget(add_btn)

        self.add_widget(root)

        self.load_goals()

    def load_goals(self):
        self.list_container.clear_widgets()

        goals = GoalEngine.list_goals()
        total_points = GoalEngine.get_total_points()
        self.points_label.text = f"Pontos: {total_points}"

        if not goals or len(goals) == 0:
            no_goals = MDLabel(
                text="Nenhuma meta cadastrada.\n\nDefina seus objetivos!",
                halign="center"
            )
            self.list_container.add_widget(no_goals)
            return

        grouped_goals = {level: [] for level in range(1, 6)}
        for g in goals:
            difficulty = self.normalize_difficulty(g.get("difficulty"))
            g["normalized_difficulty"] = difficulty
            grouped_goals[difficulty].append(g)

        for difficulty in range(1, 6):
            goals_in_level = grouped_goals.get(difficulty, [])
            if not goals_in_level:
                continue

            stars = "★" * difficulty + "☆" * (5 - difficulty)
            section_label = MDLabel(
                text=f"Dificuldade {difficulty} • {stars}",
                halign="left",
                font_style="H6",
                size_hint_y=None,
                height=dp(24),
            )
            self.list_container.add_widget(section_label)

            section_list = MDList()
            for g in goals_in_level:
                try:
                    item = self.build_goal_item(g)
                    if item:
                        section_list.add_widget(item)
                except Exception as e:
                    print(f"Erro ao carregar meta: {e}")
            self.list_container.add_widget(section_list)

    def build_goal_item(self, goal):
        status = goal.get("status", "ativa")
        progress = GoalEngine.calculate_progress(goal["id"])
        difficulty = goal.get("normalized_difficulty", self.normalize_difficulty(goal.get("difficulty")))

        stars = "★" * difficulty + "☆" * (5 - difficulty)
        status_label = "Concluída" if status == "concluida" else "Pendente"
        completed_at = self.format_completed_at(goal.get("completed_at"))
        tertiary_text = (
            f"Concluída em: {completed_at}"
            if completed_at
            else f"Status: {status_label}"
        )

        item = ThreeLineAvatarIconListItem(
            text=goal["title"],
            secondary_text=f"{stars} • {progress}",
            tertiary_text=tertiary_text,
        )

        icon = IconLeftWidget(icon="target")
        item.add_widget(icon)

        if status == "concluida":
            item.disabled = True
            item.add_widget(IconRightWidget(icon="lock"))
        else:
            item.bind(on_release=lambda x, goal=goal: self.toggle_goal_status(goal))
            edit_btn = IconRightWidget(icon="pencil")
            edit_btn.bind(on_release=lambda x, goal=goal: self.open_edit_dialog(goal))
            item.add_widget(edit_btn)
            delete_btn = IconRightWidget(icon="trash-can-outline")
            delete_btn.bind(on_release=lambda x, goal=goal: self.delete_goal(goal))
            item.add_widget(delete_btn)

        return item

    def open_add_dialog(self):
        self.open_goal_dialog()

    def open_edit_dialog(self, goal):
        self.open_goal_dialog(goal)

    def open_goal_dialog(self, goal=None):
        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(15),
            adaptive_height=True
        )

        self.editing_goal = goal
        self.selected_difficulty = self.normalize_difficulty(
            goal.get("difficulty") if goal else None
        )

        self.title_input = MDTextField(
            hint_text="Título da Meta",
            mode="rectangle"
        )
        
        self.description_input = MDTextField(
            hint_text="Detalhes da Meta (opcional)",
            mode="rectangle",
            multiline=True
        )

        self.deadline_input = MDTextField(
            hint_text="Prazo (YYYY-MM-DD) - opcional",
            mode="rectangle"
        )

        difficulty_box = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(6),
            adaptive_height=True
        )
        self.difficulty_label = MDLabel(
            text=f"Dificuldade: {'★' * self.selected_difficulty}{'☆' * (5 - self.selected_difficulty)}",
            halign="center"
        )

        self.difficulty_buttons = []
        for level in range(1, 6):
            button = MDIconButton(
                icon="star" if level <= self.selected_difficulty else "star-outline"
            )
            button.bind(on_release=lambda x, lvl=level: self.set_difficulty(lvl))
            self.difficulty_buttons.append(button)
            difficulty_box.add_widget(button)

        if goal:
            self.title_input.text = goal.get("title") or ""
            self.description_input.text = goal.get("description") or ""
            self.deadline_input.text = goal.get("deadline") or ""

        content.add_widget(self.title_input)
        content.add_widget(self.description_input)
        content.add_widget(self.deadline_input)
        self.error_label = MDLabel(
            text="",
            halign="center",
            theme_text_color="Error",
            size_hint_y=None,
            height=dp(20)
        )
        content.add_widget(self.error_label)
        content.add_widget(self.difficulty_label)
        content.add_widget(difficulty_box)

        self.dialog = MDDialog(
            title="Editar Meta" if goal else "Nova Meta",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(
                    text="Cancelar",
                    on_release=lambda x: self.dialog.dismiss()
                ),
                MDFlatButton(
                    text="Salvar",
                    on_release=lambda x: self.save_goal()
                ),
            ],
        )
        self.dialog.open()

    def save_goal(self):
        title = self.title_input.text.strip()
        description = self.description_input.text.strip() or None
        deadline = self.deadline_input.text.strip() or None

        if self.error_label:
            self.error_label.text = ""

        if not title:
            if self.error_label:
                self.error_label.text = "Informe um título para a meta."
            return

        if deadline:
            try:
                datetime.strptime(deadline, "%Y-%m-%d")
            except ValueError:
                if self.error_label:
                    self.error_label.text = "Prazo inválido. Use YYYY-MM-DD."
                return

        if self.editing_goal:
            success, message = GoalEngine.update_goal(
                goal_id=self.editing_goal["id"],
                title=title,
                description=description,
                deadline=deadline,
                difficulty=self.selected_difficulty,
            )
        else:
            success, message = GoalEngine.create_goal(
                title=title,
                description=description,
                deadline=deadline,
                difficulty=self.selected_difficulty
            )
        if not success:
            if self.error_label:
                self.error_label.text = f"Erro ao salvar: {message}"
            return

        self.dialog.dismiss()
        self.build_ui()

    def toggle_goal_status(self, goal):
        if goal.get("status") == "concluida":
            return
        success, _message = GoalEngine.complete_goal(goal["id"])
        if success:
            self.build_ui()

    def delete_goal(self, goal):
        success, _message = GoalEngine.delete_goal(goal["id"])
        if success:
            self.build_ui()

    def set_difficulty(self, level):
        self.selected_difficulty = level
        self.difficulty_label.text = f"Dificuldade: {'★' * level}{'☆' * (5 - level)}"
        for index, button in enumerate(self.difficulty_buttons, start=1):
            button.icon = "star" if index <= level else "star-outline"

    @staticmethod
    def normalize_difficulty(value):
        difficulty = value or 3
        if not isinstance(difficulty, int):
            try:
                difficulty = int(difficulty)
            except (TypeError, ValueError):
                difficulty = 3
        return min(max(difficulty, 1), 5)

    @staticmethod
    def format_completed_at(value):
        if not value:
            return None
        try:
            completed_dt = datetime.fromisoformat(value)
            return completed_dt.strftime("%d/%m/%Y %H:%M")
        except ValueError:
            return value
