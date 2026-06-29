import type { usingDataProps } from '@/types/pickleProdContents';
import { api } from '@/utils/api/api';
import { getExcelData } from './updateExcel';

export async function findChangedData(allData: usingDataProps[]) {
  const titleToIdMap = new Map();

  for (const data of allData) {
    const title = data.episodeName;
    const id = data.episodeId;

    if (titleToIdMap.has(title)) {
      titleToIdMap.get(title).push(id);
    } else {
      titleToIdMap.set(title, [id]);
    }
  }

  const allDuplicateIDs = [];
  const episodesToInsert = [];

  for (const idList of titleToIdMap.values()) {
    if (idList.length > 1) {
      allDuplicateIDs.push(...idList);
    }
  }

  for (const data of allData) {
    if (allDuplicateIDs.includes(data.episodeId)) {
      episodesToInsert.push(data);
    }
  }

  return episodesToInsert;
}

export async function findUpdateData(
  newData: usingDataProps[],
  setProgress?: (message: string) => void
) {
  // 전체 진행률: 80~100% (마지막 20%)
  const updateProgress = (stageProgress: number) => {
    const overall = Math.round(80 + stageProgress * 0.2);
    setProgress?.(
      `[전체 ${overall}%] 변경 데이터 확인 중... ${stageProgress}%`
    );
  };

  updateProgress(0);

  const excelData = (await getExcelData(
    localStorage.getItem('googleAccessToken')!,
    'episode'
  )) as usingDataProps[];

  const excelTitleMap = new Map<string, usingDataProps>();
  for (const item of excelData) {
    const title = String(item.episodeName).trim();
    if (!excelTitleMap.has(title)) {
      excelTitleMap.set(title, item);
    }
  }

  const episodesToUpdate: usingDataProps[] = [];

  // 매칭되는 항목들을 먼저 찾기
  const matchingItems = newData
    .map((newItem) => ({
      newItem,
      matchingExcelItem: excelTitleMap.get(String(newItem.episodeName).trim()),
    }))
    .filter(({ matchingExcelItem }) => matchingExcelItem !== undefined);

  if (matchingItems.length === 0) {
    return episodesToUpdate;
  }

  // 모든 에피소드 상태를 병렬로 조회
  const concurrentLimit = 10;

  for (let i = 0; i < matchingItems.length; i += concurrentLimit) {
    const batch = matchingItems.slice(i, i + concurrentLimit);

    const stageProgress = Math.round(
      ((i + batch.length) / matchingItems.length) * 100
    );
    updateProgress(stageProgress);

    const results = await Promise.all(
      batch.map(({ matchingExcelItem }) =>
        api
          .get(`admin/episode/${matchingExcelItem!.episodeId}`)
          .then((res) => ({
            episodeId: matchingExcelItem!.episodeId,
            usageYn: res.data.data.usageYn,
          }))
          .catch((err) => {
            console.error(
              `에피소드 ${matchingExcelItem!.episodeId} 조회 실패:`,
              err
            );
            return { episodeId: matchingExcelItem!.episodeId, usageYn: 'Y' };
          })
      )
    );

    // 결과 처리
    batch.forEach(({ newItem, matchingExcelItem }, idx) => {
      const { usageYn } = results[idx];
      episodesToUpdate.push(newItem);
      if (usageYn === 'N') {
        episodesToUpdate.push(matchingExcelItem!);
      }
    });
  }

  return episodesToUpdate;
}
