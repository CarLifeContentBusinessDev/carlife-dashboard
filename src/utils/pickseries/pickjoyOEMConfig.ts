export interface PickjoyOEMParams {
  manufacturerSeq: number;
  deviceSeq: number;
  companySeq: number;
}

export const PICKJOY_OEM_PARAMS: Record<string, PickjoyOEMParams> = {
  'Aurora 1 (Renault)': { manufacturerSeq: 1, deviceSeq: 1, companySeq: 1 },
  'Aurora 2 (Renault)': { manufacturerSeq: 1, deviceSeq: 8, companySeq: 1 },
};
