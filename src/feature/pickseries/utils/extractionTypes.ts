export type ExtractionProgress = {
  completed: number;
  total: number;
  currentLabel: string;
};

export type WeeklyExtractionResult = Record<
  string,
  Record<string, string | number>
>;

// date → oemName → itemName → value
export type OEMExtractionResult = Record<
  string,
  Record<string, Record<string, string | number>>
>;
