import type { SettingRow } from '@/shared/utils/googleSheets/fetchSettingData';
import type {
  PicknowOemDevice,
  PicknowSelection,
} from '@/shared/utils/googleSheets/syncPicknowConfigurationSheet.types';

export const normalizeText = (value: unknown) => {
  if (value === null || value === undefined) return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

export const compactText = (value: string) =>
  normalizeText(value).replace(/\s+/g, '');

const matchesSelection = (
  selection: PicknowSelection,
  device: PicknowOemDevice
) => {
  const selectionOem = normalizeText(selection.oem);
  const selectionDevice = normalizeText(selection.device);
  const deviceOem = normalizeText(device.oem);
  const deviceDevice = normalizeText(device.device);

  if (selectionOem === deviceOem && selectionDevice === deviceDevice) {
    return true;
  }

  const compactSelection = `${compactText(selectionOem)}${compactText(selectionDevice)}`;
  const compactDevice = `${compactText(deviceOem)}${compactText(deviceDevice)}`;

  return compactSelection === compactDevice;
};

export const resolveSelectedSeqs = (
  selections: PicknowSelection[],
  oemDevices: PicknowOemDevice[],
  settingRows: SettingRow[]
) => {
  const matchedSeqs = new Set<number>();
  const skippedSelections: PicknowSelection[] = [];
  const seqToClients = new Map<number, Set<string>>();

  selections.forEach((selection) => {
    const selectionClient = normalizeText(selection.client);
    const selectionOem = normalizeText(selection.oem);
    const selectionDevice = normalizeText(selection.device);

    const clientRows = settingRows.filter((row) => {
      return (
        normalizeText(row.고객사) === selectionClient &&
        normalizeText(row.OEM) === selectionOem &&
        normalizeText(row.DEVICE) === selectionDevice
      );
    });

    const matchedFromClient: PicknowOemDevice[] = [];

    clientRows.forEach((row) => {
      oemDevices.forEach((device) => {
        const rOem = normalizeText(row.OEM);
        const rDevice = normalizeText(row.DEVICE);
        const dOem = normalizeText(device.oem);
        const dDevice = normalizeText(device.device);

        const sameExact = rOem === dOem && rDevice === dDevice;
        const compactSame =
          `${compactText(rOem)}${compactText(rDevice)}` ===
          `${compactText(dOem)}${compactText(dDevice)}`;

        if (sameExact || compactSame) {
          matchedFromClient.push(device);
        }
      });
    });

    if (matchedFromClient.length === 0) {
      const globalMatched = oemDevices.filter((device) =>
        matchesSelection(selection, device)
      );
      if (globalMatched.length === 0) {
        skippedSelections.push(selection);
        return;
      }
      globalMatched.forEach((d) => {
        matchedSeqs.add(d.oemDeviceSeq);
        const existing = seqToClients.get(d.oemDeviceSeq) ?? new Set<string>();
        existing.add(selection.client);
        seqToClients.set(d.oemDeviceSeq, existing);
      });
      return;
    }

    matchedFromClient.forEach((device) => {
      matchedSeqs.add(device.oemDeviceSeq);
      const existing =
        seqToClients.get(device.oemDeviceSeq) ?? new Set<string>();
      existing.add(selection.client);
      seqToClients.set(device.oemDeviceSeq, existing);
    });
  });

  const mapped: Record<number, string[]> = {};
  seqToClients.forEach((set, seq) => {
    mapped[seq] = [...set];
  });

  return {
    matchedSeqs: [...matchedSeqs],
    skippedSelections,
    seqToClients: mapped,
  };
};

export const groupRowRecords = (
  rowRecords: Array<{
    category: string;
    row: (string | number)[];
  }>
) => {
  const groupedRows = new Map<
    string,
    {
      category: string;
      oems: string[];
      devices: string[];
      row: (string | number)[];
    }
  >();

  rowRecords.forEach((record) => {
    const [oem, device, ...rest] = record.row;
    const key = JSON.stringify(rest);

    const existing = groupedRows.get(key);
    if (existing) {
      existing.oems.push(String(oem ?? ''));
      existing.devices.push(String(device ?? ''));
      return;
    }

    groupedRows.set(key, {
      category: record.category,
      oems: [String(oem ?? '')],
      devices: [String(device ?? '')],
      row: rest,
    });
  });

  const results: Array<{
    category: string;
    row: (string | number)[];
  }> = [];

  for (const record of groupedRows.values()) {
    const { category, oems, devices, row } = record;

    if (oems.length === devices.length) {
      for (let i = 0; i < oems.length; i++) {
        results.push({
          category,
          row: [String(oems[i] ?? ''), String(devices[i] ?? ''), ...row],
        });
      }
    } else {
      results.push({
        category,
        row: [joinUniqueValues(oems), joinUniqueValues(devices), ...row],
      });
    }
  }

  return results;
};

const joinUniqueValues = (values: string[]): string => {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(
    '\n'
  );
};
