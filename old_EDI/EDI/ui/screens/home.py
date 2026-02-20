"""
Home Screen - Planner Diário
"""

from datetime import date
import random

from kivymd.uix.screen import MDScreen
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.card import MDCard
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.dialog import MDDialog
from kivymd.uix.textfield import MDTextField
from kivymd.uix.menu import MDDropdownMenu
from kivymd.uix.selectioncontrol import MDCheckbox
from kivy.uix.scrollview import ScrollView
from kivy.utils import get_color_from_hex
from kivy.metrics import dp

from core.activity_engine import ActivityEngine
from core.daily_log_engine import DailyLogEngine
from core.day_plan_engine import DayPlanEngine
from core.routine_engine import RoutineEngine
from core.settings_engine import SettingsEngine
from ui.components.header import ScreenHeader

COLOR_ROTINA = get_color_from_hex("#E0E0E0")
COLOR_ATIVIDADE = get_color_from_hex("#C8E6C9")


class HomeScreen(MDScreen):
    def on_enter(self):
        self.load_today()

    def load_today(self):
        self.clear_widgets()

        root = MDBoxLayout(orientation="vertical", spacing=dp(10))

        header = ScreenHeader(
            title="Planner do Dia",
            subtitle=date.today().strftime("%d/%m/%Y"),
        )
        root.add_widget(header)
        day_type_label = MDLabel(
            text=self.get_day_type_label(date.today()),
            halign="center",
            font_style="Caption",
            size_hint_y=None,
            height=dp(18),
        )
        root.add_widget(day_type_label)

        actions = MDBoxLayout(
            orientation="horizontal",
            spacing=dp(12),
            padding=[dp(16), 0, dp(16), 0],
            size_hint_y=None,
            height=dp(48),
        )
        add_activity_btn = MDRaisedButton(
            text="Adicionar atividade",
            on_release=lambda x: self.open_add_activity_dialog(),
        )
        suggest_btn = MDRaisedButton(
            text="Sugerir atividade",
            on_release=lambda x: self.suggest_activity(),
        )
        refresh_btn = MDRaisedButton(
            text="Atualizar",
            on_release=lambda x: self.load_today(),
        )
        actions.add_widget(add_activity_btn)
        actions.add_widget(suggest_btn)
        actions.add_widget(refresh_btn)
        root.add_widget(actions)

        today = date.today().isoformat()
        plan_blocks = DayPlanEngine.list_plan_blocks(today)
        if not plan_blocks:
            self.generate_plan(today)
            plan_blocks = DayPlanEngine.list_plan_blocks(today)

        activities = ActivityEngine.list_activities()
        activities_by_id = {a["id"]: a for a in activities}
        fixed_blocks = DayPlanEngine.list_fixed_blocks()
        fixed_by_start = {b["start_time"]: b for b in fixed_blocks}

        scroll = ScrollView()
        container = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            padding=dp(20),
            adaptive_height=True,
        )

        if plan_blocks:
            for block in plan_blocks:
                self.render_block(
                    container,
                    block,
                    activities,
                    activities_by_id,
                    fixed_by_start,
                )
        else:
            empty_label = MDLabel(
                text="Nenhum bloco no planner hoje.\n\n"
                "Ajuste os horários em Configurações.",
                halign="center",
                font_style="H6",
                size_hint_y=None,
                height=dp(80),
            )
            container.add_widget(empty_label)

        scroll.add_widget(container)
        root.add_widget(scroll)
        self.add_widget(root)

    def render_block(self, container, block, activities, activities_by_id, fixed_by_start):
        role = block.get("role") or block.get("source_type") or "atividade"
        bg = COLOR_ROTINA if role == "rotina" else COLOR_ATIVIDADE
        label = "Rotina" if role == "rotina" else "Atividade"

        card = MDCard(
            orientation="vertical",
            padding=dp(12),
            spacing=dp(6),
            size_hint_y=None,
            adaptive_height=True,
            radius=[12, 12, 12, 12],
        )
        card.md_bg_color = bg

        start = block.get("start_time", "N/A")
        end = self.add_minutes(start, block.get("duration", 0))
        time_label = MDLabel(
            text=f"Horário: {start} – {end}",
            bold=True,
            size_hint_y=None,
            height=dp(22),
        )

        title = block.get("title") or "Bloco livre"
        title_label = MDLabel(
            text=f"Título: {title}",
            size_hint_y=None,
            height=dp(22),
        )

        role_label = MDLabel(
            text=f"Tipo: {label}",
            font_style="Caption",
            size_hint_y=None,
            height=dp(18),
        )

        card.add_widget(time_label)
        card.add_widget(title_label)
        card.add_widget(role_label)

        activity_id = block.get("activity_id")
        if activity_id:
            fixed = fixed_by_start.get(start)
            action_row = MDBoxLayout(
                orientation="horizontal",
                spacing=dp(8),
                size_hint_y=None,
                height=dp(36),
            )
            if fixed:
                fix_btn = MDRaisedButton(
                    text="Desfixar",
                    on_release=lambda x, b=fixed: self.unfix_block(b["id"]),
                )
            else:
                fix_btn = MDRaisedButton(
                    text="Fixar para todos os dias",
                    on_release=lambda x, b=block: self.fix_block(b),
                )
            action_row.add_widget(fix_btn)

            if role == "atividade":
                checkbox = MDCheckbox(active=False)
                checkbox.bind(
                    active=lambda instance, value, b=block: self.mark_completed(
                        instance, value, b
                    )
                )
                action_row.add_widget(MDLabel(text="Concluída", size_hint_x=None, width=dp(90)))
                action_row.add_widget(checkbox)

            card.add_widget(action_row)
        else:
            self.add_activity_selector(card, block, activities)

        container.add_widget(card)

    def add_activity_selector(self, card, block, activities):
        duration = block.get("duration", 0)
        candidates = [
            a
            for a in activities
            if a.get("estimated_time") is None or a.get("estimated_time") <= duration
        ]
        if not candidates:
            label = MDLabel(
                text="Sem atividades compatíveis com este tempo.",
                font_style="Caption",
                size_hint_y=None,
                height=dp(18),
            )
            card.add_widget(label)
            return

        menu_items = []
        menu = MDDropdownMenu(width_mult=4)

        def select_activity(activity):
            role = activity.get("role") or "atividade"
            DayPlanEngine.update_plan_block(block["id"], activity["id"], role)
            self.load_today()
            menu.dismiss()

        for activity in candidates:
            menu_items.append(
                {
                    "viewclass": "OneLineListItem",
                    "text": activity["title"],
                    "on_release": lambda a=activity: select_activity(a),
                }
            )

        menu.items = menu_items
        add_btn = MDRaisedButton(
            text="Adicionar atividade",
            on_release=lambda x: self.open_menu(menu, x),
        )
        card.add_widget(add_btn)

    def open_add_activity_dialog(self):
        activities = ActivityEngine.list_activities()
        self.selected_activity = None

        content = MDBoxLayout(
            orientation="vertical",
            spacing=dp(12),
            adaptive_height=True,
        )

        self.start_time_input = MDTextField(
            hint_text="Início (HH:MM)",
            mode="rectangle",
        )
        self.duration_input = MDTextField(
            hint_text="Duração (min)",
            mode="rectangle",
            input_filter="int",
        )
        self.end_time_label = MDLabel(
            text="Término: --:--",
            halign="center",
            font_style="Caption",
            size_hint_y=None,
            height=dp(20),
        )

        self.activity_label = MDLabel(
            text="Selecione uma atividade",
            halign="center",
            theme_text_color="Primary",
            size_hint_y=None,
            height=dp(24),
        )

        self.validation_label = MDLabel(
            text="",
            halign="center",
            theme_text_color="Error",
            size_hint_y=None,
            height=dp(20),
        )

        menu_items = []
        self.activity_menu = MDDropdownMenu(width_mult=4)

        def select_activity(activity):
            self.selected_activity = activity
            role = "Rotina" if activity.get("role") == "rotina" else "Atividade"
            self.activity_label.text = f"{activity['title']} ({role})"
            self.activity_menu.dismiss()

        for activity in activities:
            menu_items.append(
                {
                    "viewclass": "OneLineListItem",
                    "text": activity["title"],
                    "on_release": lambda a=activity: select_activity(a),
                }
            )

        self.activity_menu.items = menu_items

        select_btn = MDRaisedButton(
            text="Escolher atividade",
            on_release=lambda x: self.open_menu(self.activity_menu, x),
        )

        self.start_time_input.bind(text=self.update_end_time)
        self.duration_input.bind(text=self.update_end_time)

        content.add_widget(self.start_time_input)
        content.add_widget(self.duration_input)
        content.add_widget(self.end_time_label)
        content.add_widget(self.activity_label)
        content.add_widget(select_btn)
        content.add_widget(self.validation_label)

        self.dialog = MDDialog(
            title="Adicionar atividade",
            type="custom",
            content_cls=content,
            buttons=[
                MDFlatButton(
                    text="Cancelar",
                    on_release=lambda x: self.dialog.dismiss(),
                ),
                MDFlatButton(
                    text="Salvar",
                    on_release=lambda x: self.save_new_activity(),
                ),
            ],
        )
        self.dialog.open()

    def update_end_time(self, *_args):
        start_text = self.start_time_input.text.strip()
        duration_text = self.duration_input.text.strip()
        if not self.is_valid_time(start_text):
            self.end_time_label.text = "Término: --:--"
            return
        if not duration_text.isdigit():
            self.end_time_label.text = "Término: --:--"
            return
        end_time = self.minutes_to_time(self.time_to_minutes(start_text) + int(duration_text))
        self.end_time_label.text = f"Término: {end_time}"

    def save_new_activity(self):
        start_time = self.start_time_input.text.strip()
        duration_text = self.duration_input.text.strip()

        if not self.selected_activity:
            self.validation_label.text = "Selecione uma atividade."
            return
        if not self.is_valid_time(start_time):
            self.validation_label.text = "Informe um horário válido."
            return
        if not duration_text.isdigit() or int(duration_text) <= 0:
            self.validation_label.text = "Informe uma duração válida."
            return

        duration = int(duration_text)
        start_minutes = self.time_to_minutes(start_time)
        end_minutes = start_minutes + duration

        wake_time = SettingsEngine.get_setting("wake_time", "07:00")
        sleep_time = SettingsEngine.get_setting("sleep_time", "22:00")
        wake_minutes = self.time_to_minutes(wake_time)
        sleep_minutes = self.time_to_minutes(sleep_time)
        if sleep_minutes <= wake_minutes:
            sleep_minutes = wake_minutes + 60

        if start_minutes < wake_minutes or end_minutes > sleep_minutes:
            self.validation_label.text = "Horário fora do período configurado."
            return

        today = date.today().isoformat()
        plan_blocks = DayPlanEngine.list_plan_blocks(today)
        occupied_blocks = []
        free_blocks = []
        for block in plan_blocks:
            block_info = {
                "id": block["id"],
                "start": self.time_to_minutes(block["start_time"]),
                "duration": block["duration"],
                "activity_id": block.get("activity_id"),
            }
            if block.get("activity_id"):
                occupied_blocks.append(block_info)
            else:
                free_blocks.append(block_info)

        candidate = {"start": start_minutes, "duration": duration}
        if self.has_overlap(candidate, occupied_blocks):
            self.validation_label.text = "O horário conflita com outro bloco."
            return

        for block in free_blocks:
            if not self.has_overlap(candidate, [block]):
                continue
            DayPlanEngine.remove_plan_block(block["id"])
            block_start = block["start"]
            block_end = block["start"] + block["duration"]
            if start_minutes > block_start:
                self.insert_plan_block(
                    today,
                    block_start,
                    start_minutes - block_start,
                    None,
                    "atividade",
                )
            if end_minutes < block_end:
                self.insert_plan_block(
                    today,
                    end_minutes,
                    block_end - end_minutes,
                    None,
                    "atividade",
                )

        source_type = self.selected_activity.get("role") or "atividade"
        DayPlanEngine.insert_plan_block(
            today,
            start_time,
            duration,
            self.selected_activity["id"],
            source_type,
        )
        self.dialog.dismiss()
        self.load_today()

    def open_menu(self, menu, caller):
        menu.caller = caller
        menu.open()

    def generate_plan(self, plan_date):
        wake_time = SettingsEngine.get_setting("wake_time", "07:00")
        sleep_time = SettingsEngine.get_setting("sleep_time", "22:00")
        fixed_rule = SettingsEngine.get_setting("fixed_rule", "todos_os_dias")
        is_workday = self.is_workday(plan_date)

        wake_minutes = self.time_to_minutes(wake_time)
        sleep_minutes = self.time_to_minutes(sleep_time)
        if sleep_minutes <= wake_minutes:
            sleep_minutes = wake_minutes + 60

        include_fixed = True
        if fixed_rule == "somente_trabalho":
            include_fixed = is_workday
        elif fixed_rule == "somente_folga":
            include_fixed = not is_workday

        fixed_blocks = DayPlanEngine.list_fixed_blocks() if include_fixed else []
        routine_blocks = self.build_routine_blocks()

        accepted = []
        for block in fixed_blocks:
            start = self.time_to_minutes(block["start_time"])
            end = start + block["duration"]
            if start < wake_minutes or end > sleep_minutes:
                continue
            accepted.append(
                {
                    "start": start,
                    "duration": block["duration"],
                    "activity_id": block["activity_id"],
                    "source_type": block.get("source_type", "rotina"),
                }
            )

        for block in routine_blocks:
            if self.has_overlap(block, accepted):
                continue
            if block["start"] < wake_minutes or block["start"] + block["duration"] > sleep_minutes:
                continue
            accepted.append(block)

        accepted.sort(key=lambda b: b["start"])

        DayPlanEngine.clear_plan(plan_date)
        current = wake_minutes
        for block in accepted:
            if block["start"] > current:
                self.insert_plan_block(
                    plan_date,
                    current,
                    block["start"] - current,
                    None,
                    "atividade",
                )
            self.insert_plan_block(
                plan_date,
                block["start"],
                block["duration"],
                block.get("activity_id"),
                block.get("source_type", "rotina"),
            )
            current = max(current, block["start"] + block["duration"])

        if current < sleep_minutes:
            self.insert_plan_block(
                plan_date,
                current,
                sleep_minutes - current,
                None,
                "atividade",
            )

    def build_routine_blocks(self):
        routines = RoutineEngine.list_routines()
        blocks = []
        for routine in routines:
            if not routine.get("start"):
                continue
            start_minutes = self.time_to_minutes(routine["start"])
            routine_blocks = RoutineEngine.list_blocks(routine["id"])
            current = start_minutes
            for block in routine_blocks:
                blocks.append(
                    {
                        "start": current,
                        "duration": block["duration"],
                        "activity_id": block.get("activity_id"),
                        "source_type": "rotina",
                    }
                )
                current += block["duration"]
        return blocks

    def insert_plan_block(self, plan_date, start_minutes, duration, activity_id, source_type):
        start_time = self.minutes_to_time(start_minutes)
        DayPlanEngine.insert_plan_block(
            plan_date,
            start_time,
            duration,
            activity_id,
            source_type,
        )

    def suggest_activity(self):
        today = date.today().isoformat()
        plan_blocks = DayPlanEngine.list_plan_blocks(today)
        free_blocks = [b for b in plan_blocks if not b.get("activity_id")]
        if not free_blocks:
            return

        role_filter = SettingsEngine.get_setting("suggest_role", "qualquer")
        activities = ActivityEngine.list_activities()
        if role_filter in {"atividade", "rotina"}:
            activities = [a for a in activities if a.get("role") == role_filter]

        suggest_rule = SettingsEngine.get_setting("auto_suggest_rule", "primeiro_bloco")
        if suggest_rule == "bloco_aleatorio":
            target_block = random.choice(free_blocks)
        else:
            target_block = free_blocks[0]
        compatible = [
            a
            for a in activities
            if a.get("estimated_time") is None
            or a.get("estimated_time") <= target_block.get("duration", 0)
        ]
        if not compatible:
            return

        chosen = random.choice(compatible)
        role = chosen.get("role") or "atividade"
        DayPlanEngine.update_plan_block(target_block["id"], chosen["id"], role)
        self.load_today()

    def fix_block(self, block):
        DayPlanEngine.upsert_fixed_block(
            block["start_time"],
            block["duration"],
            block["activity_id"],
            block.get("source_type", "atividade"),
        )
        self.load_today()

    def unfix_block(self, block_id):
        DayPlanEngine.remove_fixed_block(block_id)
        self.load_today()

    def mark_completed(self, _instance, value, block):
        if not value:
            return
        activity_id = block.get("activity_id")
        if not activity_id:
            return
        timestamp = block.get("start_time")
        if DailyLogEngine.is_activity_logged(activity_id, timestamp):
            return
        DailyLogEngine.register_activity_at(
            activity_id,
            block.get("duration", 0),
            1,
            timestamp,
        )

    @staticmethod
    def time_to_minutes(time_str):
        try:
            hours, minutes = time_str.split(":")
            return int(hours) * 60 + int(minutes)
        except ValueError:
            return 0

    @staticmethod
    def minutes_to_time(total_minutes):
        hours = total_minutes // 60
        minutes = total_minutes % 60
        return f"{hours:02d}:{minutes:02d}"

    def add_minutes(self, time_str, minutes):
        start = self.time_to_minutes(time_str)
        return self.minutes_to_time(start + (minutes or 0))

    def is_workday(self, target_date):
        if isinstance(target_date, str):
            target_date = date.fromisoformat(target_date)
        work_days = SettingsEngine.get_work_days()
        return target_date.weekday() in work_days

    def get_day_type_label(self, target_date):
        return "Dia de trabalho" if self.is_workday(target_date) else "Dia de folga"

    @staticmethod
    def is_valid_time(time_str):
        parts = time_str.split(":")
        if len(parts) != 2:
            return False
        hours, minutes = parts
        if not (hours.isdigit() and minutes.isdigit()):
            return False
        hours = int(hours)
        minutes = int(minutes)
        return 0 <= hours <= 23 and 0 <= minutes <= 59

    @staticmethod
    def has_overlap(candidate, existing):
        start = candidate["start"]
        end = candidate["start"] + candidate["duration"]
        for block in existing:
            block_start = block["start"]
            block_end = block["start"] + block["duration"]
            if start < block_end and end > block_start:
                return True
        return False
