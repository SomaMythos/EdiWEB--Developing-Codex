import React, { useState } from "react";
import DailyHeader from "../components/daily/DailyHeader";
import DailyTimeline from "../components/daily/DailyTimeline";
import DayConfigModal from "../components/daily/DayConfigModal";
import RoutinesModal from "../components/daily/RoutinesModal";
import ActivitiesModal from "../components/daily/ActivitiesModal";
import { useDailyPlan } from "../hooks/daily/useDailyPlan";
import { useDailyConfig } from "../hooks/daily/useDailyConfig";
import { useDailyRoutines } from "../hooks/daily/useDailyRoutines";
import { useActivities } from "../hooks/daily/useActivities";
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

  const dailyPlan = useDailyPlan(selectedDate);
  const dailyConfig = useDailyConfig();
  const dailyRoutines = useDailyRoutines(selectedDate, dailyPlan.dayType);
  const activities = useActivities();
  const notScheduled = dailyPlan.generationResult?.notScheduled || [];
  const diagnostics = dailyPlan.generationResult?.diagnostics;

  return (
    <div className="daily-page">
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

      <DailyTimeline
        blocks={dailyPlan.blocks}
        loadState={dailyPlan.loadState}
        onToggleCompletion={dailyPlan.toggleCompletion}
      />

      {dailyPlan.generationResult && (
        <section className="daily-generation-panel">
          <h3>Resultado da geração</h3>
          {notScheduled.length === 0 ? (
            <p className="daily-generation-panel__empty">Todas as atividades foram alocadas.</p>
          ) : (
            <ul className="daily-generation-panel__list">
              {notScheduled.map((item, index) => {
                const reason = item?.reason;
                return (
                  <li key={`${item?.activity_id || item?.id || index}-${reason || "unknown"}`}>
                    <div><strong>{getActivityLabel(item)}</strong></div>
                    <div>Motivo: {getReasonLabel(reason)} ({reason || "unknown"})</div>
                    <div>Sugestão: {getSuggestion(reason)}</div>
                  </li>
                );
              })}
            </ul>
          )}

          {diagnostics && (
            <div className="daily-generation-panel__diagnostics">
              <h4>Diagnósticos</h4>
              <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
