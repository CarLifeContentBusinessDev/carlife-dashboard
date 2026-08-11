import { toast } from 'react-toastify';
import {
  batchUpdateSpreadsheet,
  getSheetValues,
  getSpreadsheetMeta,
  updateSheetValues,
} from '@/feature/pickle-prod/utils/pickleProdSheetApi';
import type {
  usingChannelProps,
  usingDataProps,
} from '@/shared/types/pickleProdContents';
import formatDateString from '@/shared/utils/format/formatDateString';
import { formatPlayTime } from '@/shared/utils/format/formatPlayTime';
import { buildSheetRange } from './sheetRange';

const STARTROW = 4;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function excelDateTime(date?: string | number) {
  if (!date) return '';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '' : formatDateString(d.toISOString());
}

export async function appendNewDataToTop(
  newData: (usingDataProps | usingChannelProps)[],
  setProgress: (progress: string) => void,
  category: 'episode' | 'channel',
  setLoading: (loading: boolean) => void,
  sheetName: string,
  showToast: boolean = true,
  spreadsheetId: string = import.meta.env.VITE_SPREADSHEET_ID
) {
  if (newData.length === 0) {
    if (showToast) toast.info('추가할 데이터가 없습니다.');
    return;
  }

  try {
    setLoading(true);

    const sortedData = [...newData].sort((a, b) => {
      if (category === 'episode') {
        const dispDateA = new Date(a.dispDtime).getTime();
        const dispDateB = new Date(b.dispDtime).getTime();
        if (dispDateB !== dispDateA) return dispDateB - dispDateA;

        const createdDateA = new Date(a.createdAt).getTime();
        const createdDateB = new Date(b.createdAt).getTime();
        return createdDateB - createdDateA;
      }

      const createdDateA = new Date(a.createdAt).getTime();
      const createdDateB = new Date(b.createdAt).getTime();
      if (createdDateB !== createdDateA) return createdDateB - createdDateA;

      const dispDateA = new Date(a.dispDtime).getTime();
      const dispDateB = new Date(b.dispDtime).getTime();
      return dispDateB - dispDateA;
    });

    const filteredData = sortedData;

    // Step 1: 시트 ID 가져오기
    const sheetId = await getSheetId(sheetName, spreadsheetId);

    // 중복 방지: 실제 쓰기 직전에 현재 시트에 있는 ID들을 다시 조회해서 제거
    const { getExcelData } = await import('./updateExcel');
    const existingRows = await getExcelData(category, sheetName, spreadsheetId);
    const existingIds = new Set(
      existingRows.map((item) =>
        'episodeId' in item ? item.episodeId : item.channelId
      )
    );

    const dedupedData = filteredData.filter((item) => {
      const id = 'episodeId' in item ? item.episodeId : item.channelId;
      return !existingIds.has(id);
    });

    if (dedupedData.length === 0) {
      setLoading(false);
      if (showToast)
        toast.info('추가할 신규 데이터가 없습니다 (이미 시트에 존재).');
      return;
    }

    // 새로 쓸 데이터는 dedupedData로 갱신
    const effectiveData = dedupedData;

    // Step 2: 비어있으면 행 확장, 있으면 행 삽입
    const isEmpty = await isSheetEmpty(sheetName, spreadsheetId);

    if (isEmpty) {
      const neededRows = STARTROW - 1 + filteredData.length + 100;
      setProgress(`시트 크기 확장 중... (${neededRows}행)`);
      await batchUpdateSpreadsheet(spreadsheetId, [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { rowCount: neededRows },
            },
            fields: 'gridProperties.rowCount',
          },
        },
      ]);
    } else {
      const INSERT_BATCH_SIZE = 10000;
      for (let i = 0; i < filteredData.length; i += INSERT_BATCH_SIZE) {
        const batchCount = Math.min(INSERT_BATCH_SIZE, filteredData.length - i);
        const startIndex = STARTROW - 1 + i;
        await batchUpdateSpreadsheet(spreadsheetId, [
          {
            insertDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex,
                endIndex: startIndex + batchCount,
              },
              inheritFromBefore: false,
            },
          },
        ]);
        setProgress(
          `행 삽입 중... (${Math.min(i + INSERT_BATCH_SIZE, filteredData.length)}/${filteredData.length})`
        );
      }
    }

    // Step 3: 데이터 변환 로직
    let allNewValues: (string | number)[][];
    if (category === 'episode') {
      allNewValues = (effectiveData as usingDataProps[]).map((row) => [
        row.episodeId,
        row.usageYn,
        row.channelName,
        row.episodeName,
        excelDateTime(row.dispDtime),
        excelDateTime(row.createdAt),
        formatPlayTime(row.playTime),
        row.likeCnt,
        row.listenCnt,
        row.thumbnailUrl,
        row.audioUrl,
        row.channelId,
      ]);
    } else {
      allNewValues = (effectiveData as usingChannelProps[]).map((row) => [
        row.channelId,
        row.usageYn,
        row.channelName,
        row.vendorName,
        row.categoryName,
        row.episodeCount ?? 0,
        excelDateTime(row.dispDtime),
        row.channelTypeName,
        row.likeCnt,
        row.listenCnt,
        excelDateTime(row.createdAt),
        row.interfaceUrl,
        row.thumbnailUrl,
      ]);
    }

    // Step 4: 배치 쓰기
    const batchSize = 2000;
    const batches = Math.ceil(allNewValues.length / batchSize);
    let totalWritten = 0;

    for (let batchIdx = 0; batchIdx < batches; batchIdx++) {
      const batchStart = batchIdx * batchSize;
      const batchEnd = Math.min(
        (batchIdx + 1) * batchSize,
        allNewValues.length
      );
      const batchData = allNewValues.slice(batchStart, batchEnd);
      const startRow = STARTROW + batchStart;
      const range = buildSheetRange(sheetName, `B${startRow}`);

      await updateSheetValues(spreadsheetId, range, batchData);

      totalWritten += batchData.length;
      const percentage = Math.round((totalWritten / allNewValues.length) * 100);
      setProgress(
        `데이터 쓰기 중... (${totalWritten}/${allNewValues.length}, ${percentage}%)`
      );
      await delay(500);
    }

    setProgress('');
    setLoading(false);
    if (showToast)
      toast.success(`${filteredData.length}개의 데이터가 추가되었습니다!`);
  } catch (err: unknown) {
    setLoading(false);
    setProgress('');
    toast.error(`데이터 추가에 실패했습니다`);
    throw err;
  }
}

// 시트 이름으로 시트 ID를 가져옴
async function getSheetId(
  sheetName: string,
  spreadsheetId: string
): Promise<number> {
  try {
    const meta = await getSpreadsheetMeta(spreadsheetId);

    const availableSheets =
      meta.sheets?.map((s) => s.properties?.title) || [];

    const sheet = meta.sheets?.find((s) => {
      const title = s.properties?.title;
      // trim으로 양쪽 공백 제거 후 비교
      return title?.trim() === sheetName.trim();
    });

    if (!sheet || sheet.properties?.sheetId === undefined) {
      throw new Error(
        `시트를 찾을 수 없습니다: "${sheetName}"\n사용 가능한 시트: ${availableSheets.join(', ')}`
      );
    }

    return sheet.properties.sheetId;
  } catch (err) {
    console.error('시트 ID 조회 실패:', err);
    throw err;
  }
}

// 시트가 비어있는지 확인 (STARTROW 기준)
async function isSheetEmpty(
  sheetName: string,
  spreadsheetId: string
): Promise<boolean> {
  try {
    const values = await getSheetValues(
      spreadsheetId,
      buildSheetRange(sheetName, `B${STARTROW}:B${STARTROW}`)
    );
    return !values || values.length === 0;
  } catch (err) {
    console.error('시트 빈 상태 확인 실패:', err);
    return false;
  }
}
