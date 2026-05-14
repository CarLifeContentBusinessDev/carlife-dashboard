import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import JSEncrypt from 'jsencrypt';
import { picknowApi } from '@/utils/api/api';
import { useAccessTokenStore } from '@/store/useAccessTokenStore';
import { setServiceToken } from '@/store/useServiceStore';

const PICKNOW_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\n${import.meta.env.VITE_PICKNOW_PUBLIC_KEY_STG}\n-----END PUBLIC KEY-----`;
const TEST_ID = import.meta.env.VITE_TEST_ID ?? 'dev';
const TEST_PW = import.meta.env.VITE_TEST_PW ?? 'dev';

interface PicknowLoginData {
  adminSeq: number;
  email: string;
  userName: string;
  roleId: string;
  accessToken: string;
  refreshToken: string;
}

interface PicknowLoginResponse {
  resultCode: string;
  resultMessage: string;
  data: PicknowLoginData;
}

export default function PicknowLogin() {
  const navigate = useNavigate();
  const { setAccessToken } = useAccessTokenStore();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('rememberId_picknow');
    if (savedId) {
      setId(savedId);
      setRemember(true);
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      if (import.meta.env.DEV && id === TEST_ID && password === TEST_PW) {
        const devAccessToken = 'dev-access-token';
        const devRefreshToken = 'dev-refresh-token';

        setAccessToken(devAccessToken);
        setServiceToken('picknow', devAccessToken);
        localStorage.setItem('refreshToken', devRefreshToken);
        toast.success('개발 계정으로 로그인되었습니다.');
        navigate('/picknow/excel-sync');
        return;
      }

      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(PICKNOW_PUBLIC_KEY);
      const encryptedPassword = encrypt.encrypt(password);

      if (!encryptedPassword) {
        setError('비밀번호 암호화에 실패했습니다.');
        setLoading(false);
        return;
      }

      const res = await picknowApi.post<PicknowLoginResponse>(
        '/admin/login',
        { email: id, password: encryptedPassword },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const { resultCode, data } = res.data;
      if (resultCode === 'SUCCESS') {
        setAccessToken(data.accessToken);
        setServiceToken('picknow', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        if (remember) {
          localStorage.setItem('rememberId_picknow', id);
        } else {
          localStorage.removeItem('rememberId_picknow');
        }

        toast.success('로그인에 성공하였습니다.');
        navigate('/picknow/excel-sync');
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (err) {
      console.error(err);
      setError('서버와 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <div className='min-h-screen bg-[#F6F7FA] flex items-center justify-center'>
      <div className='bg-white rounded-2xl shadow-lg p-10 w-96 flex flex-col gap-6'>
        <div className='text-center'>
          <img
            src='/picknow_logo.svg'
            alt='로고'
            width={48}
            height={48}
            className='mx-auto mb-3'
          />
          <h2 className='text-2xl font-bold text-[#1B1E2F]'>Picknow Admin</h2>
          <p className='text-sm text-gray-500 mt-1'>
            관리자 계정으로 로그인하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          {error && <p className='text-red-500 text-sm text-center'>{error}</p>}

          <input
            type='text'
            placeholder='아이디'
            value={id}
            onChange={(e) => setId(e.target.value)}
            className='border border-gray-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
          />

          <input
            type='password'
            placeholder='비밀번호'
            autoComplete='current-password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className='border border-gray-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
          />

          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className='w-4 h-4 cursor-pointer'
            />
            아이디 저장하기
          </label>

          <button
            disabled={loading}
            type='submit'
            className='bg-[#1B1E2F] cursor-pointer text-white rounded-md p-3 mt-2 hover:opacity-90 transition disabled:opacity-50'
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <button
          onClick={() => navigate('/')}
          className='text-sm text-gray-400 text-center hover:text-gray-600 cursor-pointer'
        >
          ← 서비스 선택으로 돌아가기
        </button>
      </div>
    </div>
  );
}
