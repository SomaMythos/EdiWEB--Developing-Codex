from kivymd.app import MDApp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.screenmanager import MDScreenManager

from data.database import initialize_database
from ui.components.bottom_bar import BottomBar

# v2.0
from ui.screens.dashboard import DashboardScreen
from ui.screens.profile import ProfileScreen
from ui.screens.books import BooksScreen
from ui.screens.shopping import ShoppingScreen
from ui.screens.paintings import PaintingsScreen
from ui.screens.stats import StatsScreen
from ui.screens.settings import SettingsScreen

# v1.x / rotina
from ui.screens.home import HomeScreen
from ui.screens.routine import RoutineScreen
from ui.screens.create_routine import CreateRoutineScreen
from ui.screens.routine_detail import RoutineDetailScreen
from ui.screens.add_routine_block import AddRoutineBlockScreen

# outros
from ui.screens.activities import ActivitiesScreen
from ui.screens.activity_types import ActivityTypesScreen
from ui.screens.goals import GoalsScreen


class LifeManagerApp(MDApp):
    def build(self):
        self.title = "EDI v2.0 - Life Manager"

        initialize_database()

        root = MDBoxLayout(orientation="vertical")
        sm = MDScreenManager()

        # Dashboard / Perfil
        sm.add_widget(DashboardScreen(name="dashboard"))
        sm.add_widget(ProfileScreen(name="profile"))
        sm.add_widget(BooksScreen(name="books"))
        sm.add_widget(ShoppingScreen(name="shopping"))
        sm.add_widget(PaintingsScreen(name="paintings"))
        sm.add_widget(StatsScreen(name="stats"))
        sm.add_widget(SettingsScreen(name="settings"))

        # Core
        sm.add_widget(HomeScreen(name="home"))
        sm.add_widget(RoutineScreen(name="routine"))
        sm.add_widget(CreateRoutineScreen(name="create_routine"))
        sm.add_widget(RoutineDetailScreen(name="routine_detail"))
        sm.add_widget(AddRoutineBlockScreen(name="add_routine_block"))

        sm.add_widget(ActivitiesScreen(name="activities"))
        sm.add_widget(ActivityTypesScreen(name="types"))
        sm.add_widget(GoalsScreen(name="goals"))

        root.add_widget(sm)
        root.add_widget(BottomBar(screen_manager=sm))

        return root


if __name__ == "__main__":
    LifeManagerApp().run()
