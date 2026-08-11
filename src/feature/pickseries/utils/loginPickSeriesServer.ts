import type { PickSeriesServer } from '@/constants/servers';
import { getPicknowServerApi } from '@/shared/utils/api/api';
import axios from 'axios';
import JSEncrypt from 'jsencrypt';

interface PickSeriesLoginResponse {
  resultCode: string;
  resultMessage: string;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

export type PickSeriesServerLoginResult =
  | {
      server: PickSeriesServer;
      success: true;
      accessToken: string;
      refreshToken: string;
    }
  | { server: PickSeriesServer; success: false; message: string };

export async function loginPickSeriesServer(
  server: PickSeriesServer,
  id: string,
  password: string
): Promise<PickSeriesServerLoginResult> {
  try {
    let passwordToSend = password;

    if (server.publicKey) {
      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(server.publicKey);
      const encryptedPassword = encrypt.encrypt(password);
      if (!encryptedPassword) {
        return {
          server,
          success: false,
          message: '비밀번호 암호화에 실패했습니다.',
        };
      }
      passwordToSend = encryptedPassword;
    }

    const loginData = server.id.startsWith('pickle')
      ? { adminId: id, password: passwordToSend }
      : { email: id, password: passwordToSend };

    const serverApi = getPicknowServerApi(server);
    const loginUrl =
      server.id === 'pickjoy' ? '/api/admin/v1/login' : '/admin/login';

    const res = await serverApi.post<PickSeriesLoginResponse>(
      loginUrl,
      loginData,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (res.data.resultCode === 'SUCCESS') {
      const { accessToken, refreshToken } = res.data.data;
      return { server, success: true, accessToken, refreshToken };
    }
    return { server, success: false, message: res.data.resultMessage };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.resultMessage) {
      return {
        server,
        success: false,
        message: err.response.data.resultMessage,
      };
    }
    return { server, success: false, message: '서버에 연결할 수 없습니다.' };
  }
}
