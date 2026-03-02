import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import {
  analyticsApi,
  dashboardApi,
  financeApi,
  goalsApi,
  notificationsApi,
  shoppingApi,
} from '../services/api';
import DailyReportCard from '../components/reports/DailyReportCard';
import GoalReportCard from '../components/reports/GoalReportCard';
import HobbyReportFeed from '../components/reports/HobbyReportFeed';
import FinanceReportPanel from '../components/reports/FinanceReportPanel';
import './Dashboard.css';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [overview, setOverview] = useState(null);
  const [todayData, setTodayData] = useState(null);
  const [lastDaysData, setLastDaysData] = useState([]);
  const [topActivities, setTopActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [goalsOverview, setGoalsOverview] = useState([]);
  const [moduleSummary, setModuleSummary] = useState({
    goals: 0,
    notifications: 0,
    shoppingPending: 0,
    financeFixedExpenses: 0,
  });

  const quickActions = useMemo(
    () => [
      { path: '/', label: 'Daily' },
      { path: '/goals', label: 'Metas' },
      { path: '/financeiro', label: 'Financeiro' },
      { path: '/shopping', label: 'Shopping' },
      { path: '/notifications', label: 'Notificações' },
    ],
    []
  );

  const formatMinutes = (minutes) => {
    const total = Number(minutes || 0);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const completionRateToday =
    todayData && todayData.total > 0 ? Math.round((todayData.done / todayData.total) * 100) : 0;

  const averageCompletionRate =
    lastDaysData.length > 0
      ? Math.round(lastDaysData.reduce((sum, day) => sum + (day.completion_rate || 0), 0) / lastDaysData.length)
      : 0;

  const totalPeriodActivityTime = lastDaysData.reduce((sum, day) => sum + (day.total_time || 0), 0);
  const activeDays = lastDaysData.filter((d) => (d.total || 0) > 0).length;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [
        dashboardRes,
        todayRes,
        lastDaysRes,
        topActivitiesRes,
        goalsOverviewRes,
        goalsRes,
        notificationsRes,
        shoppingStatsRes,
        financeExpensesRes,
      ] = await Promise.allSettled([
        dashboardApi.getOverview(),
        analyticsApi.getToday(),
        analyticsApi.getLastDays(selectedPeriod),
        analyticsApi.getTopActivities(5),
        analyticsApi.getGoalsOverview(),
        goalsApi.list(),
        notificationsApi.list({ status: 'unread', include_generated: true }),
        shoppingApi.stats(),
        financeApi.listFixedExpenses(),
      ]);

      if (dashboardRes.status === 'fulfilled') setOverview(dashboardRes.value?.data?.data || null);
      if (todayRes.status === 'fulfilled') setTodayData(todayRes.value?.data?.data || null);
      if (lastDaysRes.status === 'fulfilled') setLastDaysData(lastDaysRes.value?.data?.data || []);

      if (topActivitiesRes.status === 'fulfilled') {
        const activities = topActivitiesRes.value?.data?.data || [];
        setTopActivities(activities);
        setSelectedActivity((prev) => activities.find((activity) => activity.title === prev?.title) || activities[0] || null);
      }

      if (goalsOverviewRes.status === 'fulfilled') setGoalsOverview(goalsOverviewRes.value?.data?.data || []);

      setModuleSummary({
        goals: goalsRes.status === 'fulfilled' ? (goalsRes.value?.data?.data || []).length : 0,
        notifications: notificationsRes.status === 'fulfilled' ? (notificationsRes.value?.data?.data || []).length : 0,
        shoppingPending:
          shoppingStatsRes.status === 'fulfilled' ? Number(shoppingStatsRes.value?.data?.data?.unbought_items || 0) : 0,
        financeFixedExpenses:
          financeExpensesRes.status === 'fulfilled' ? (financeExpensesRes.value?.data?.data || []).length : 0,
      });

      setLoading(false);
    };

    loadData();
  }, [selectedPeriod]);

  return (
    <div className="page-container fade-in dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>
            <Home size={28} className="dashboard-title-icon" />
            Reports Dashboard
          </h1>
          <p>Painel principal de reports por módulos: Daily, Metas, Hobbies e Financeiro.</p>
        </div>

        <div className="dashboard-header-controls">
          <div className="period-selector" role="group" aria-label="Filtrar período">
            {[7, 30, 90].map((period) => (
              <button
                key={period}
                className={`btn ${selectedPeriod === period ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setSelectedPeriod(period)}
              >
                {period} dias
              </button>
            ))}
          </div>
          <div className="dashboard-quick-actions">
            {quickActions.map((item) => (
              <Link key={item.path} to={item.path} className="btn btn-secondary btn-sm">
                Abrir {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="reports-modules-layout">
        <DailyReportCard
          overview={overview}
          todayData={todayData}
          completionRateToday={completionRateToday}
          averageCompletionRate={averageCompletionRate}
          totalPeriodActivityTime={totalPeriodActivityTime}
          activeDays={activeDays}
          selectedActivity={selectedActivity}
          onSelectActivity={setSelectedActivity}
          topActivities={topActivities}
          formatMinutes={formatMinutes}
        />

        <GoalReportCard
          overview={overview}
          goalsOverview={goalsOverview}
          totalGoals={moduleSummary.goals}
        />

        <HobbyReportFeed topActivities={topActivities} />

        <FinanceReportPanel moduleSummary={moduleSummary} />
      </div>

      {loading && <p className="dashboard-loading">Atualizando dados...</p>}
    </div>
  );
};

export default Dashboard;
