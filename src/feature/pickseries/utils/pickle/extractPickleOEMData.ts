import type {
  ExtractionProgress,
  OEMExtractionResult,
} from '@/feature/pickseries/utils/extractionTypes';
import type { OEMGroup } from '@/feature/pickseries/utils/fetchPickSeriesOEMSheet';

export async function extractPickleOEMData(_params: {
  token: string;
  oems: OEMGroup[];
  selectedItemsByOEM: Record<string, Set<string>>;
  dates: string[];
  onProgress: (p: ExtractionProgress) => void;
}): Promise<OEMExtractionResult> {
  return {};
}
