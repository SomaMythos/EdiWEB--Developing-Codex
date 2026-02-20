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

export default function Daily() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const dailyPlan = useDailyPlan(selectedDate);
  const dailyConfig = useDailyConfig();
  const dailyRoutines = useDailyRoutines(selectedDate, dailyPlan.dayType);
  const activities = useActivities();

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
    </div>
  );
}
