import React, { useEffect, useMemo, useState } from "react";
import DailyHeader from "../components/daily/DailyHeader";
import DailyTimeline from "../components/daily/DailyTimeline";
import DayConfigModal from "../components/daily/DayConfigModal";
import RoutinesModal from "../components/daily/RoutinesModal";
import ActivitiesModal from "../components/daily/ActivitiesModal";
import EditBlockModal from "../components/daily/EditBlockModal";
import { useDailyPlan } from "../hooks/daily/useDailyPlan";
import { useDailyConfig } from "../hooks/daily/useDailyConfig";
import { useDailyRoutines } from "../hooks/daily/useDailyRoutines";
import { useActivities } from "../hooks/daily/useActivities";
import { dailyApi, dayConfigApi } from "../services/api";
import "./Daily.css";

const REASON_LABELS = {
  no_slot: "Sem janela de horário disponível",
  conflict_fixed_block: "Conflito com bloco fixo"
};

const REASON_SUGGESTIONS = {
  no_slot: "Tente reduzir a duração da atividade ou redistribuir blocos no dia.",
  conflict_fixed_block: "Ajuste a rotina/fixos para remover conflitos ou altere os pesos de prioridade."
};

function getActivityLabel(item) {
  return item?.activity_name || item?.title || item?.name || `Atividade #${item?.activity_id ?? "-"}`;
}

function getReasonLabel(reason) {
  return REASON_LABELS[reason] || reason || "Motivo não informado";
}

function getSuggestion(reason) {
  return REASON_SUGGESTIONS[reason] || "Revise a duração, ajuste a rotina e reavalie os pesos de prioridade.";
}

export default function Daily() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [editingBlock, setEditingBlock] = useState(null);
  const [insightsState, setInsightsState] = useState({ loading: true, error: null });
  const [consistency, setConsistency] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [dayConfigSnapshot, setDayConfigSnapshot] = useState(null);
  const [applyingAdjustment, setApplyingAdjustment] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    quickActions: false,
    consistencyInsights: false,
    generationInsights: false,
    onboarding: false
  });

  const dailyPlan = useDailyPlan(selectedDate);
  const dailyConfig = useDailyConfig();
  const dailyRoutines = useDailyRoutines(selectedDate, dailyPlan.dayType);
  const activities = useActivities();
  const notScheduled = dailyPlan.generationResult?.notScheduled || [];
  const diagnostics = dailyPlan.generationResult?.diagnostics;

  useEffect(() => {
    const loadInsights = async () => {
      setInsightsState({ loading: true, error: null });
      try {
        const [consistencyRes, weeklyRes, configRes] = await Promise.all([
          dailyApi.getConsistency(7),
          dailyApi.getWeeklyStats(selectedDate),
          dayConfigApi.get()
        ]);

        setConsistency(consistencyRes?.data?.data || { average: 0, days: [] });
        setWeeklyStats(weeklyRes?.data?.data?.items || []);
        setDayConfigSnapshot(configRes?.data?.data || null);
        setInsightsState({ loading: false, error: null });
      } catch (error) {
        console.error(error);
        setInsightsState({ loading: false, error: "Não foi possível carregar os insights diários." });
      }
    };

    loadInsights();
  }, [selectedDate]);

  const topActivities = useMemo(() => weeklyStats.slice(0, 3), [weeklyStats]);

  const lowExecutionActivities = useMemo(() => {
    return weeklyStats
      .filter((item) => item.times_scheduled > 0)
      .map((item) => ({
        ...item,
        completionRate: Math.round((item.times_completed / item.times_scheduled) * 100)
      }))
      .filter((item) => item.times_scheduled >= 2 && item.completionRate < 50)
      .slice(0, 3);
  }, [weeklyStats]);

  const recommendation = useMemo(() => {
    if (!dayConfigSnapshot || weeklyStats.length === 0 || !consistency) {
      return null;
    }

    const totals = weeklyStats.reduce((acc, item) => {
      acc.scheduled += item.times_scheduled;
      acc.completed += item.times_completed;
      return acc;
    }, { scheduled: 0, completed: 0 });

    const completionRate = totals.scheduled > 0 ? totals.completed / totals.scheduled : 0;
    const hasLowExecution = lowExecutionActivities.length > 0;

    if (completionRate < 0.55 || consistency.average < 60) {
      return {
        type: "weights",
        title: "Ajuste recomendado: reduzir pressão e equilibrar diversão",
        description: "A execução semanal está baixa. Sugestão: reduzir disciplina_weight em 1 e aumentar fun_weight em 1.",
        payload: {
          discipline_weight: Math.max(0, Number(dayConfigSnapshot.discipline_weight || 0) - 1),
          fun_weight: Number(dayConfigSnapshot.fun_weight || 0) + 1
        },
        durationHint: hasLowExecution ? "Também é recomendado reduzir a duração das atividades com baixa execução em 10-15 minutos." : null
      };
    }

    if (completionRate > 0.85 && consistency.average > 80) {
      return {
        type: "weights",
        title: "Ajuste recomendado: aumentar desafio",
        description: "Seu ritmo está consistente. Sugestão: aumentar discipline_weight em 1 para priorizar atividades de disciplina.",
        payload: {
          discipline_weight: Number(dayConfigSnapshot.discipline_weight || 0) + 1,
          fun_weight: Number(dayConfigSnapshot.fun_weight || 0)
        },
        durationHint: null
      };
    }

    return {
      type: "duration",
      title: "Plano equilibrado",
      description: "Sem necessidade de ajuste automático de pesos no momento.",
      payload: null,
      durationHint: hasLowExecution ? "Se quiser otimizar, reduza a duração das atividades sinalizadas para melhorar a aderência." : null
    };
  }, [consistency, dayConfigSnapshot, lowExecutionActivities.length, weeklyStats]);

  const applyRecommendedAdjustment = async () => {
    if (!recommendation?.payload || !dayConfigSnapshot || applyingAdjustment) return;

    const confirmed = window.confirm("Aplicar ajuste recomendado nos pesos da configuração diária?");
    if (!confirmed) return;

    setApplyingAdjustment(true);
    try {
      await dayConfigApi.save({
        ...dayConfigSnapshot,
        ...recommendation.payload
      });

      const updatedConfig = {
        ...dayConfigSnapshot,
        ...recommendation.payload
      };

      setDayConfigSnapshot(updatedConfig);
      if (dailyConfig.config) {
        dailyConfig.setConfig(updatedConfig);
      }
    } catch (error) {
      console.error(error);
      window.alert("Não foi possível aplicar o ajuste recomendado.");
    } finally {
      setApplyingAdjustment(false);
    }
  };

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  return (
    <div className="daily-page">
      <section className="daily-section">
        <DailyHeader
          dayType={dailyPlan.dayType}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          summary={dailyPlan.summary}
          blocks={dailyPlan.blocks}
          completedDuration={dailyPlan.completedDuration}
          totalDuration={dailyPlan.totalDuration}
          generating={dailyPlan.generating}
          onGenerate={dailyPlan.generateDaily}
          onToggleDay={dailyPlan.toggleDayType}
          onOpenConfig={dailyConfig.fetchConfig}
          onOpenRoutines={dailyRoutines.fetchActiveRoutine}
          onOpenActivities={activities.fetchActivities}
          actionState={dailyPlan.actionState}
        />
      </section>

      {/* AÇÕES RÁPIDAS - INVISÍVEL */}
      <section className="daily-section daily-section--quick-actions" style={{ display: "none" }}>
        <div className="daily-section__header">
          <h3>Ações rápidas</h3>
          <button className="daily-section__collapse" onClick={() => toggleSection("quickActions")}>
            {collapsedSections.quickActions ? "Expandir" : "Minimizar"}
          </button>
        </div>
        {!collapsedSections.quickActions && (
          <div className="daily-chip-grid">
            <button className="daily-chip" onClick={dailyPlan.generateDaily}>Gerar plano agora</button>
            <button className="daily-chip" onClick={dailyRoutines.fetchActiveRoutine}>Revisar rotina ativa</button>
            <button className="daily-chip" onClick={activities.fetchActivities}>Ativar/desativar atividades</button>
            <button className="daily-chip" onClick={dailyConfig.fetchConfig}>Ajustar regras do dia</button>
          </div>
        )}
      </section>

      <section className="daily-section">
        <h3>Timeline</h3>
        <DailyTimeline
          blocks={dailyPlan.blocks}
          loadState={dailyPlan.loadState}
          onToggleCompletion={dailyPlan.toggleCompletion}
          onEditBlock={setEditingBlock}
        />
      </section>

      {/* INSIGHTS DE CONSISTÊNCIA - INVISÍVEL */}
      <section className="daily-section daily-insights-cards" style={{ display: "none" }}>
        <div className="daily-section__header">
          <h3>Insights de consistência e execução</h3>
          <button className="daily-section__collapse" onClick={() => toggleSection("consistencyInsights")}>
            {collapsedSections.consistencyInsights ? "Expandir" : "Minimizar"}
          </button>
        </div>
      </section>

      {/* INSIGHTS DE GERAÇÃO - INVISÍVEL */}
      <section className="daily-section daily-generation-panel" style={{ display: "none" }}>
        <div className="daily-section__header">
          <h3>Insights</h3>
          <button className="daily-section__collapse" onClick={() => toggleSection("generationInsights")}>
            {collapsedSections.generationInsights ? "Expandir" : "Minimizar"}
          </button>
        </div>
      </section>

      {/* ONBOARDING - INVISÍVEL */}
      <section className="daily-section daily-onboarding" style={{ display: "none" }}>
        <div className="daily-section__header">
          <h3>Onboarding contextual</h3>
          <button className="daily-section__collapse" onClick={() => toggleSection("onboarding")}>
            {collapsedSections.onboarding ? "Expandir" : "Minimizar"}
          </button>
        </div>
      </section>

      <DayConfigModal
        show={dailyConfig.showConfig}
        config={dailyConfig.config}
        setConfig={dailyConfig.setConfig}
        onClose={() => dailyConfig.setShowConfig(false)}
        onSave={dailyConfig.saveConfig}
        state={dailyConfig.state}
      />

      <RoutinesModal
        show={dailyRoutines.showRoutineModal}
        dayType={dailyPlan.dayType}
        activeRoutine={dailyRoutines.activeRoutine}
        routineBlocks={dailyRoutines.routineBlocks}
        newBlock={dailyRoutines.newBlock}
        setNewBlock={dailyRoutines.setNewBlock}
        state={dailyRoutines.state}
        onCreateRoutine={dailyRoutines.createRoutine}
        onAddBlock={dailyRoutines.addRoutineBlock}
        onRemoveBlock={dailyRoutines.removeRoutineBlock}
        onClose={() => dailyRoutines.setShowRoutineModal(false)}
      />

      <ActivitiesModal
        show={activities.showActivitiesModal}
        activities={activities.activities}
        newActivity={activities.newActivity}
        setNewActivity={activities.setNewActivity}
        validationErrors={activities.validationErrors}
        state={activities.state}
        onFrequencyChange={activities.handleFrequencyChange}
        onToggleActivity={activities.toggleActivity}
        onDeleteActivity={activities.deleteActivity}
        onCreateActivity={activities.createActivity}
        onClose={() => activities.setShowActivitiesModal(false)}
      />

      <EditBlockModal
        show={Boolean(editingBlock)}
        block={editingBlock}
        onClose={() => setEditingBlock(null)}
        onSave={dailyPlan.updateBlock}
      />
    </div>
  );
}
