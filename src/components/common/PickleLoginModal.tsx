import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { api, setTestMode } from '../../utils/api/api';
import { useAccessTokenStore } from '../../store/useAccessTokenStore';
import { setServiceToken } from '../../store/useServiceStore';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import type { LoginResponseData } from '../../types/type';

interface LoginApiResponse {
  resultCode: string;
  resultMessage: string;
  data: LoginResponseData;
}

interface Props {
  onClose: () => void;
}

export default function PickleLoginModal({ onClose }: Props) {
  const navigate = useNavigate();
  const { setAccessToken } = useAccessTokenStore();
  const { clearLoginToken } = useLoginTokenStore();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('rememberId_pickle');
    if (savedId) {
      setId(savedId);
      setRemember(true);
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const testId = import.meta.env.VITE_TEST_ID;
      const testPw = import.meta.env.VITE_TEST_PW;
      if (testId && testPw && id === testId && password === testPw) {
        clearLoginToken();
        if (remember) {
          localStorage.setItem('rememberId_pickle', id);
        } else {
          localStorage.removeItem('rememberId_pickle');
        }

        let supabaseToken = 'TEST_TOKEN';
        const { data: supabaseData } = await supabase.auth.signInWithPassword({
          email: testId,
          password: testPw,
        });
        if (supabaseData.session?.access_token) {
          supabaseToken = supabaseData.session.access_token;
        }

        setTestMode(true);
        setAccessToken(supabaseToken);
        setServiceToken('pickle', supabaseToken);
        toast.success('테스트 계정으로 로그인했습니다.');
        onClose();
        navigate('/episode-list');
        return;
      }

      let apiLoginData: LoginResponseData | null = null;
      try {
        const res = await api.post<LoginApiResponse>(
          '/admin/login',
          { adminId: id, password },
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (res.data.resultCode === 'SUCCESS') {
          apiLoginData = res.data.data;
        }
      } catch {
        // 네트워크 오류 등
      }

      if (!apiLoginData) {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      setAccessToken(apiLoginData.accessToken);
      setServiceToken('pickle', apiLoginData.accessToken);
      localStorage.setItem('refreshToken', apiLoginData.refreshToken);

      supabase.auth.signInWithPassword({ email: id, password }).catch(() => {
        console.warn('Supabase 세션 연동 실패 - 일부 기능이 제한될 수 있습니다.');
      });

      if (remember) {
        localStorage.setItem('rememberId_pickle', id);
      } else {
        localStorage.removeItem('rememberId_pickle');
      }

      toast.success('로그인에 성공하였습니다.');
      onClose();
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
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className='bg-white rounded-2xl shadow-xl p-8 w-96 flex flex-col gap-5'>
        <div className='text-center'>
          <img
            src='/pickle_logo.svg'
            alt='로고'
            width={40}
            height={40}
            className='mx-auto mb-3'
          />
          <h2 className='text-xl font-bold text-[#1B1E2F]'>Pickle Admin</h2>
          <p className='text-sm text-gray-500 mt-1'>관리자 계정으로 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          {error && (
            <p className='text-red-500 text-sm text-center'>{error}</p>
          )}
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
