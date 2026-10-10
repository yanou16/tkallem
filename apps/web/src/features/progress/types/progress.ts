export type ProgressMetrics = {
  mistakes_per_100: number;
  words_per_answer: number;
  hesitations_per_min: number;
  speaking_seconds: number;
};

export type ProgressData = {
  current: ProgressMetrics;
  baseline?: ProgressMetrics;
  top_mistakes: Array<Record<string, unknown>>;
};
