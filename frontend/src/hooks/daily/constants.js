export const API_URL = "http://localhost:8000/api";

export const DEFAULT_SUMMARY = {
  total_blocks: 0,
  completed_blocks: 0,
  percentage: 0
};

export const DEFAULT_ACTIVITY = {
  title: "",
  min_duration: 30,
  max_duration: 60,
  frequency_type: "flex",
  fixed_time: "",
  fixed_duration: 30,
  is_disc: true,
  is_fun: false
};

export const DEFAULT_ROUTINE_BLOCK = {
  name: "",
  start_time: "",
  end_time: "",
  category: "fixed"
};
