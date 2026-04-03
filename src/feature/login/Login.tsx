import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { supabase } from '../../lib/supabase';
import type { LoginResponseData } from '../../type';

interface LoginPopupProps {
  onClose: () => void;
  onLoginSuccess?: (data: LoginResponseData) => void;
}

interface LoginApiResponse {
  resultCode: string;
  resultMessage: string;
  data: LoginResponseData;
}

export default function LoginPopup({
  onClose,
  onLoginSuccess,
}: LoginPopupProps) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('rememberId');
    if (savedId) {
      setId(savedId);
      setRemember(true);
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // supabase 로그인 시도
      const { error: supabaseError } = await supabase.auth.signInWithPassword({
        email: id,
        password: password,
      });
      if (supabaseError) {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
        setLoading(false);
        return;
      }

      // 상용 API 로그인
      const res = await api.post<LoginApiResponse>(
        'https://pickle.obigo.ai/admin/login',
        {
          adminId: id,
          password: password,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = res.data;

      if (data.resultCode === 'SUCCESS') {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        console.log(localStorage.getItem('accessToken'));
        if (remember) {
          localStorage.setItem('rememberId', id);
        } else {
          localStorage.removeItem('rememberId');
        }

        if (onLoginSuccess) onLoginSuccess(data.data);

        window.location.reload();
      } else {
        setError(data.resultMessage || '로그인 실패');
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
    <div
      className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className='relative bg-white p-8 rounded-xl w-80 flex flex-col gap-4'
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type='button'
          className='absolute top-4 cursor-pointer right-6 text-md text-gray-500 mt-2'
        >
          X
        </button>
        <h2 className='text-center text-xl font-semibold'>로그인</h2>

        {error && <p className='text-red-500 text-sm text-center'>{error}</p>}

        <input
          type='text'
          placeholder='아이디'
          value={id}
          onChange={(e) => setId(e.target.value)}
          className='border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
        />

        <input
          type='password'
          placeholder='비밀번호'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className='border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
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
          className='bg-point-color cursor-pointer text-white rounded-md p-2 mt-2 hover:opacity-90 transition disabled:opacity-50'
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
