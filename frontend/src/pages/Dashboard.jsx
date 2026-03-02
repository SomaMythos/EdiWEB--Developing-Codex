import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import {
  analyticsApi,
  dashboardApi,
  financeApi,
  goalsApi,
  notificationsApi,
  reportsApi,
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
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [goalsOverview, setGoalsOverview] = useState([]);
  const [dailyOverview, setDailyOverview] = useState(null);
  const [dailyStreaks, setDailyStreaks] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [activityDetail, setActivityDetail] = useState(null);
  const [goalsSummary, setGoalsSummary] = useState(null);
  const [hobbyLog, setHobbyLog] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
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
        reportsOverviewRes,
        reportsStreakRes,
        reportsTimeseriesRes,
        goalsSummaryRes,
        hobbiesLogRes,
        financeSummaryRes,
      ] = await Promise.allSettled([
        dashboardApi.getOverview(),
        analyticsApi.getToday(),
        analyticsApi.getLastDays(selectedPeriod),
        analyticsApi.getTopActivities(10),
        analyticsApi.getGoalsOverview(),
        goalsApi.list(),
        notificationsApi.list({ status: 'unread', include_generated: true }),
        shoppingApi.stats(),
        financeApi.listFixedExpenses(),
        reportsApi.getDailyOverview(),
        reportsApi.getDailyStreaks(),
        reportsApi.getDailyTimeseries(selectedPeriod),
        reportsApi.getGoalsSummary(),
        reportsApi.getHobbiesLog({ limit: 120 }),
        reportsApi.getFinanceSummary(),
      ]);

      if (dashboardRes.status === 'fulfilled') setOverview(dashboardRes.value?.data?.data || null);
      if (todayRes.status === 'fulfilled') setTodayData(todayRes.value?.data?.data || null);
      if (lastDaysRes.status === 'fulfilled') setLastDaysData(lastDaysRes.value?.data?.data || []);
      if (reportsOverviewRes.status === 'fulfilled') setDailyOverview(reportsOverviewRes.value?.data?.data || null);
      if (reportsStreakRes.status === 'fulfilled') setDailyStreaks(reportsStreakRes.value?.data?.data || null);
      if (reportsTimeseriesRes.status === 'fulfilled') setTimeseries(reportsTimeseriesRes.value?.data?.data || []);
      if (goalsSummaryRes.status === 'fulfilled') setGoalsSummary(goalsSummaryRes.value?.data?.data || null);
      if (hobbiesLogRes.status === 'fulfilled') setHobbyLog(hobbiesLogRes.value?.data?.data || []);
      if (financeSummaryRes.status === 'fulfilled') setFinanceSummary(financeSummaryRes.value?.data?.data || null);

      if (topActivitiesRes.status === 'fulfilled') {
        const activities = topActivitiesRes.value?.data?.data || [];
        setTopActivities(activities);
        setSelectedActivityId((prev) => prev || activities[0]?.id || null);
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

  useEffect(() => {
    if (!selectedActivityId) {
      setActivityDetail(null);
      return;
    }

    reportsApi
      .getDailyActivityDetail(selectedActivityId)
      .then((res) => setActivityDetail(res?.data?.data || null))
      .catch(() => setActivityDetail(null));
  }, [selectedActivityId]);

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
          topActivities={topActivities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={setSelectedActivityId}
          activityDetail={activityDetail}
          dailyOverview={dailyOverview}
          dailyStreaks={dailyStreaks}
          timeseries={timeseries}
          formatMinutes={formatMinutes}
        />

        <GoalReportCard
          overview={overview}
          goalsOverview={goalsOverview}
          totalGoals={moduleSummary.goals}
        />

        <HobbyReportFeed hobbyLog={hobbyLog} />

        <FinanceReportPanel moduleSummary={moduleSummary} financeSummary={financeSummary} />


      <section className="report-module goals-summary-report">
        <div className="report-module-header">
          <h2>Report de Metas</h2>
          <p>Concluídas na semana, no mês e ranking por categoria.</p>
        </div>

        <div className="report-grid report-grid--two">
          <article className="stat-card">
            <div>
              <p className="stat-label">Concluídas na semana</p>
              <p className="stat-value">{goalsSummary?.completed_week || 0}</p>
            </div>
          </article>
          <article className="stat-card">
            <div>
              <p className="stat-label">Concluídas no mês</p>
              <p className="stat-value">{goalsSummary?.completed_month || 0}</p>
            </div>
          </article>
        </div>

        <div className="report-grid report-grid--two">
          <article className="goal-overview-card">
            <p className="stat-label">Categoria com mais concluídas</p>
            <p className="stat-value">{goalsSummary?.ranking?.most_completed?.category || 'Sem categoria'}</p>
            <p className="empty-state">
              Total: {goalsSummary?.ranking?.most_completed?.completed || 0}
            </p>
          </article>
          <article className="goal-overview-card">
            <p className="stat-label">Categoria com menos concluídas</p>
            <p className="stat-value">{goalsSummary?.ranking?.least_completed?.category || 'Sem categoria'}</p>
            <p className="empty-state">
              Total: {goalsSummary?.ranking?.least_completed?.completed || 0}
            </p>
          </article>
        </div>
      </section>
      </div>

      {loading && <p className="dashboard-loading">Atualizando dados...</p>}
    </div>
  );
};

export default Dashboard;
