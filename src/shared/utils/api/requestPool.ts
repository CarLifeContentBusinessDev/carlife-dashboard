/**
 * 동시 요청 개수를 제한하는 유틸
 * 대량의 API 요청을 순차적으로 처리하여 서버 부하 방지
 */

export interface PoolOptions {
  concurrency?: number; // 동시 요청 개수 (기본값: 5)
}

/**
 * 프로미스를 동시 요청 개수 제한과 함께 실행
 * @param tasks 실행할 비동기 함수 배열
 * @param options 옵션 (동시 요청 개수)
 * @returns Promise.allSettled와 동일한 결과
 */
export async function executeWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  options: PoolOptions = {}
): Promise<PromiseSettledResult<T>[]> {
  const { concurrency = 5 } = options;
  const results: PromiseSettledResult<T>[] = [];
  let executing = 0;
  let completed = 0;

  return new Promise((resolve, reject) => {
    if (tasks.length === 0) {
      resolve([]);
      return;
    }

    // 결과 배열을 task 개수만큼 미리 할당
    results.length = tasks.length;

    const executeNext = async () => {
      if (executing >= concurrency) return;

      const taskIndex = completed;
      if (taskIndex >= tasks.length) return;

      executing += 1;
      completed += 1;

      try {
        const result = await tasks[taskIndex]();
        results[taskIndex] = { status: 'fulfilled', value: result };
      } catch (error) {
        results[taskIndex] = { status: 'rejected', reason: error };
      }

      executing -= 1;

      // 모든 task가 완료되었는지 확인
      if (completed === tasks.length && executing === 0) {
        resolve(results);
        return;
      }

      // 다음 task 실행
      executeNext();
    };

    // 초기 동시 요청 시작
    for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
      executeNext().catch(reject);
    }
  });
}
