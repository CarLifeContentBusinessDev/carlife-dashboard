import { useState, useEffect } from 'react';
import JSEncrypt from 'jsencrypt';
import { toast } from 'react-toastify';
import { getPicknowServerApi } from '@/shared/utils/api/api';
import type { PicknowServer, PickSeriesServer } from '@/constants/servers';

interface Props {
  server: PicknowServer | PickSeriesServer;
  onClose: () => void;
  setServerToken: (id: string, token: string, refreshToken: string) => void;
}

interface PicknowLoginResponse {
  resultCode: string;
  resultMessage: string;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

export default function ServerLoginModal({
  server,
  onClose,
  setServerToken,
}: Props) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const logoSrc = server.id.startsWith('pickle')
    ? '/pickle_logo.svg'
    : server.id.startsWith('picknow')
      ? '/picknow_logo.svg'
      : '/pickseries_logo.svg';

  useEffect(() => {
    const savedId = localStorage.getItem(`rememberId_${server.id}`);
    if (savedId) {
      setId(savedId);
      setRemember(true);
    }
  }, [server.id]);

  const handleLogin = async () => {
    if (!id.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let passwordToSend = password;

      if (server.publicKey) {
        const encrypt = new JSEncrypt();
        encrypt.setPublicKey(server.publicKey);
        const encryptedPassword = encrypt.encrypt(password);
        if (!encryptedPassword) {
          setError('비밀번호 암호화에 실패했습니다.');
          return;
        }
        passwordToSend = encryptedPassword;
      }

      let loginData = server.label.startsWith('Pickle')
        ? { adminId: id, password: passwordToSend }
        : server.label.startsWith('Picknow')
          ? { email: id, password: passwordToSend }
          : { email: id, password: passwordToSend };

      const serverApi = getPicknowServerApi(server);
      const loginUrl = server.label.startsWith('Pickjoy')
        ? '/api/admin/v1/login'
        : '/admin/login';

      const res = await serverApi.post<PicknowLoginResponse>(
        loginUrl,
        loginData,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (res.data.resultCode === 'SUCCESS') {
        const { accessToken, refreshToken } = res.data.data;
        setServerToken(server.id, accessToken, refreshToken);
        if (remember) {
          localStorage.setItem(`rememberId_${server.id}`, id);
        } else {
          localStorage.removeItem(`rememberId_${server.id}`);
        }
        toast.success(`${server.label} 로그인에 성공하였습니다.`);
        onClose();
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } catch {
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
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className='bg-white rounded-2xl shadow-xl p-8 w-96 flex flex-col gap-5'>
        <div className='text-center'>
          <img
            src={logoSrc}
            alt='로고'
            width={40}
            height={40}
            className='mx-auto mb-3'
          />
          <h2 className='text-xl font-bold text-[#1B1E2F]'>{server.label}</h2>
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
            className='bg-[#1B1E2F] cursor-pointer text-white rounded-md p-3 mt-1 hover:opacity-90 transition disabled:opacity-50'
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <button
          onClick={onClose}
          className='text-sm text-gray-400 text-center hover:text-gray-600 cursor-pointer'
        >
          취소
        </button>
      </div>
    </div>
  );
}
