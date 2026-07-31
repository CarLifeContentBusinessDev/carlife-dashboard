import pickseriesLogo from '@/assets/pickseries_logo.svg';
import { PICKSERIES_SERVERS } from '@/constants/servers';
import { loginPickSeriesServer } from '@/feature/pickseries/utils/loginPickSeriesServer';
import { useState } from 'react';
import { toast } from 'react-toastify';

interface Props {
  onClose: () => void;
  setServerToken: (id: string, token: string, refreshToken: string) => void;
}

const REMEMBER_ID_KEY = 'pickSeriesRememberId';

export default function PickSeriesLoginModal({
  onClose,
  setServerToken,
}: Props) {
  const [id, setId] = useState(
    () => localStorage.getItem(REMEMBER_ID_KEY) ?? ''
  );
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(
    () => !!localStorage.getItem(REMEMBER_ID_KEY)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!id.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');

    const results = await Promise.all(
      PICKSERIES_SERVERS.map((server) => {
        if (!server.isActive) {
          return Promise.resolve({
            server,
            success: false,
            message: '아직 연동되지 않은 서버입니다.',
            accessToken: '',
            refreshToken: '',
          });
        }

        return loginPickSeriesServer(server, id, password);
      })
    );

    let successCount = 0;
    results.forEach((result) => {
      if (result.success) {
        successCount += 1;
        setServerToken(
          result.server.id,
          result.accessToken,
          result.refreshToken
        );
      } else if (result.message === '아직 연동되지 않은 서버입니다.') {
        console.log(`${result.server.label} 서버는 아직 연동되지 않았습니다.`);
      } else {
        toast.error(`${result.server.label} 로그인 실패: ${result.message}`);
      }
    });

    if (remember) {
      localStorage.setItem(REMEMBER_ID_KEY, id);
    } else {
      localStorage.removeItem(REMEMBER_ID_KEY);
    }

    setLoading(false);

    if (successCount > 0) {
      toast.success(`픽시리즈 서버 로그인 성공`);
      onClose();
    } else {
      setError('모든 서버 로그인에 실패했습니다.');
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
            src={pickseriesLogo}
            alt='로고'
            width={40}
            height={40}
            className='mx-auto mb-3'
          />
          <h2 className='text-xl font-bold text-[#1B1E2F]'>
            PickSeries 로그인
          </h2>
          <p className='text-sm text-gray-500 mt-1'>
            관리자 계정으로 전체 서버에 한 번에 로그인합니다
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
            {loading ? '로그인 중...' : '전체 서버 로그인'}
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
