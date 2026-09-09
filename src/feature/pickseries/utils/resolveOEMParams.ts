import type { AxiosInstance } from 'axios';
import {
  fetchManufacturers,
  fetchDevicesByManufacturer,
  fetchCompanies,
} from './pickjoy/pickjoyItemApis';

export interface OEMApiParams {
  manufacturerSeq: number;
  deviceSeq: number;
  companySeqs: number[];
}

// OEM명 파싱: "AR1(Renault)" → { deviceName: "AR1", manufacturerName: "Renault" }
export function parseOEMName(
  name: string
): { deviceName: string; manufacturerName: string } | null {
  const match = name.match(/^(.+)\((.+)\)$/);
  if (!match) return null;
  return { deviceName: match[1].trim(), manufacturerName: match[2].trim() };
}

// API에서 manufacturer/device/company를 조회해 OEM명별 params를 동적으로 빌드
export async function buildOEMParamsMap(
  api: AxiosInstance,
  oemNames: string[]
): Promise<Record<string, OEMApiParams>> {
  const [manufacturers, companies] = await Promise.all([
    fetchManufacturers(api),
    fetchCompanies(api),
  ]);

  const deviceLists = await Promise.all(
    manufacturers.map((m) =>
      fetchDevicesByManufacturer(api, m.manufacturerName)
    )
  );
  const allDevices = deviceLists.flat();

  const companySeqs = companies.map((c) => c.companySeq);
  const paramsMap: Record<string, OEMApiParams> = {};

  for (const name of oemNames) {
    const parsed = parseOEMName(name);
    if (!parsed) continue;

    const manufacturer = manufacturers.find(
      (m) => m.manufacturerName === parsed.manufacturerName
    );
    if (!manufacturer) continue;

    const device = allDevices.find(
      (d) =>
        d.deviceName === parsed.deviceName &&
        d.manufacturerSeq === manufacturer.manufacturerSeq
    );
    if (!device) continue;

    paramsMap[name] = {
      manufacturerSeq: manufacturer.manufacturerSeq,
      deviceSeq: device.deviceSeq,
      companySeqs,
    };
  }

  return paramsMap;
}
