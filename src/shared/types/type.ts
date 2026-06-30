export type ExcelRow = (string | number | null)[];

export interface LoginResponseData {
  adminSeq: number;
  email: string;
  adminName: string;
  roleId: string;
  accessToken: string;
  refreshToken: string;
}
