import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { api } from '../../utils/api/api';
import { useAccessTokenStore } from '../../store/useAccessTokenStore';
import { setServiceToken } from '../../store/useServiceStore';
import type { LoginResponseData } from '../../types/type';

interface LoginApiResponse {
  resultCode: string;
  resultMessage: string;
  data: LoginResponseData;
}

export default function PickleLogin() {
  const navigate = useNavigate();
  const { accessToken, setAccessToken } = useAccessTokenStore();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (accessToken) navigate('/episode-list', { replace: true });
  }, [accessToken, navigate]);

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
      const { data: supabaseData, error: supabaseError } =
        await supabase.auth.signInWithPassword({ email: id, password });

      if (supabaseError || !supabaseData.session) {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      if (remember) {
        localStorage.setItem('rememberId', id);
      } else {
        localStorage.removeItem('rememberId');
      }

      setAccessToken(supabaseData.session.access_token);

      try {
        const res = await api.post<LoginApiResponse>(
          '/admin/login',
          { adminId: id, password },
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (res.data.resultCode === 'SUCCESS') {
          setAccessToken(res.data.data.accessToken);
          setServiceToken('pickle', res.data.data.accessToken);
          localStorage.setItem('refreshToken', res.data.data.refreshToken);
        }
      } catch {
        console.warn(
          'pickle API 연결 실패 - Google Sheets 기능을 사용할 수 없습니다.'
        );
      }

      toast.success('로그인에 성공하였습니다.');
      navigate('/episode-list');
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
            src='/pickle_logo.svg'
            alt='로고'
            width={48}
            height={48}
            className='mx-auto mb-3'
          />
          <h2 className='text-2xl font-bold text-[#1B1E2F]'>Pickle Admin</h2>
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
