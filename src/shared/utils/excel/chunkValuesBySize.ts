// Vercel Serverless Function 요청 본문 한도(4.5MB, 조정 불가)를 넘지 않도록
// 시트 쓰기용 2D 값 배열을 직렬화 크기 기준으로 분할한다.
// 나머지 JSON 페이로드(action/spreadsheetId/range 등)와 오버헤드 여유분을 남긴다.
export const MAX_SHEET_PAYLOAD_BYTES = 3_500_000;

export interface ValuesChunk<T> {
  /** 이 청크의 행들 */
  rows: T[][];
  /** 전체 values 기준 이 청크 첫 행의 인덱스(0-base) */
  offset: number;
}

/**
 * values 를 각 청크의 JSON 직렬화 크기가 maxBytes 이하가 되도록 순서대로 분할한다.
 * 단일 행이 maxBytes 를 넘으면 그 행만 담은 청크를 그대로 반환한다(더 쪼갤 수 없음).
 */
export function chunkValuesBySize<T>(
  values: T[][],
  maxBytes: number = MAX_SHEET_PAYLOAD_BYTES
): ValuesChunk<T>[] {
  const chunks: ValuesChunk<T>[] = [];
  let current: T[][] = [];
  let currentBytes = 2; // "[]"
  let offset = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    // 행 하나의 직렬화 크기 + 구분자(",") 1바이트
    const rowBytes = byteLength(JSON.stringify(row)) + 1;

    if (current.length > 0 && currentBytes + rowBytes > maxBytes) {
      chunks.push({ rows: current, offset });
      offset = i;
      current = [];
      currentBytes = 2;
    }

    current.push(row);
    currentBytes += rowBytes;
  }

  if (current.length > 0) {
    chunks.push({ rows: current, offset });
  }

  return chunks;
}

function byteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  // 폴백: 대략적인 UTF-8 바이트 수
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}
