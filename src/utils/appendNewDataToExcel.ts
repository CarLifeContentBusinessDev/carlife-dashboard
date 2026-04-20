import { toast } from 'react-toastify';
import type { usingChannelProps, usingDataProps } from '../types/type';
import { getGoogleToken, getSheetsClient } from './auth';
import formatDateString from './formatDateString';
import { formatPlayTime } from './formatPlayTime';

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

    // 시작 전 토큰 체크 및 유효화
    await getGoogleToken();
    const sheets = getSheetsClient();

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

    // Step 1: 시트 ID 가져오기 (내부에서 getSheetsClient 사용)
    const sheetId = await getSheetId(sheetName, spreadsheetId);

    // Step 2: 비어있으면 행 확장, 있으면 행 삽입
    const isEmpty = await isSheetEmpty(sheetName, spreadsheetId);

    if (isEmpty) {
      const neededRows = STARTROW - 1 + filteredData.length + 100;
      setProgress(`시트 크기 확장 중... (${neededRows}행)`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { rowCount: neededRows },
                },
                fields: 'gridProperties.rowCount',
              },
            },
          ],
        },
      });
    } else {
      const INSERT_BATCH_SIZE = 10000;
      for (let i = 0; i < filteredData.length; i += INSERT_BATCH_SIZE) {
        // 대량 행 삽입 중 토큰 만료 방지
        await getGoogleToken();

        const batchCount = Math.min(INSERT_BATCH_SIZE, filteredData.length - i);
        const startIndex = STARTROW - 1 + i;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
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
            ],
          },
        });
        setProgress(
          `행 삽입 중... (${Math.min(i + INSERT_BATCH_SIZE, filteredData.length)}/${filteredData.length})`
        );
      }
    }

    // Step 3: 데이터 변환 로직
    let allNewValues: any[][];
    if (category === 'episode') {
      allNewValues = (filteredData as usingDataProps[]).map((row) => [
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
      allNewValues = (filteredData as usingChannelProps[]).map((row) => [
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
      // 실제 API 쓰기 직전에 항상 토큰 체크/갱신
      await getGoogleToken();

      const batchStart = batchIdx * batchSize;
      const batchEnd = Math.min(
        (batchIdx + 1) * batchSize,
        allNewValues.length
      );
      const batchData = allNewValues.slice(batchStart, batchEnd);
      const startRow = STARTROW + batchStart;
      const range = `${sheetName}!B${startRow}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: { values: batchData },
      });

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
  } catch (err: any) {
    setLoading(false);
    setProgress('');
    const errorMessage = err.result?.error?.message || '알 수 없는 오류';
    toast.error(`데이터 추가에 실패했습니다: ${errorMessage}`);
    throw err;
  }
}

// 시트 이름으로 시트 ID를 가져옴
async function getSheetId(
  sheetName: string,
  spreadsheetId: string
): Promise<number> {
  try {
    // API 호출 전 토큰 체크
    await getGoogleToken();
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const availableSheets =
      response.result.sheets?.map((s) => s.properties?.title) || [];

    const sheet = response.result.sheets?.find((s) => {
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
    await getGoogleToken();
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!B${STARTROW}:B${STARTROW}`,
    });
    const values = response.result.values;
    return !values || values.length === 0;
  } catch (err) {
    console.error('시트 빈 상태 확인 실패:', err);
    return false;
  }
}
