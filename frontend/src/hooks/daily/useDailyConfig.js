import { useState } from "react";
import { dayConfigApi } from "../../services/api";
import { createUiState, parseIntegerOrFallback } from "./utils";

export function useDailyConfig() {
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState(null);
  const [state, setState] = useState(createUiState());

  const fetchConfig = async () => {
    setState(createUiState("loading"));
    try {
      const res = await dayConfigApi.get();
      if (res.data.success) {
        setConfig(res.data.data);
        setShowConfig(true);
      }
      setState(createUiState("success"));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível carregar as configurações do dia."));
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setState(createUiState("loading"));
    try {
      await dayConfigApi.save({
        sleep_start: config.sleep_start,
        sleep_end: config.sleep_end,
        work_start: config.work_start,
        work_end: config.work_end,
        buffer_between: parseIntegerOrFallback(config.buffer_between, 0),
        granularity_min: parseIntegerOrFallback(config.granularity_min, 1),
        avoid_category_adjacent: Boolean(config.avoid_category_adjacent),
        discipline_weight: parseIntegerOrFallback(config.discipline_weight, 1),
        fun_weight: parseIntegerOrFallback(config.fun_weight, 1)
      });
      setShowConfig(false);
      setState(createUiState("success", null, "Configuração salva com sucesso."));
    } catch (error) {
      console.error(error);
      setState(createUiState("error", "Não foi possível salvar a configuração do dia."));
    }
  };

  return {
    showConfig,
    setShowConfig,
    config,
    setConfig,
    state,
    fetchConfig,
    saveConfig,
    clearState: () => setState(createUiState())
  };
}
