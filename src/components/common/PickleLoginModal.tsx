import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { supabase } from '../../lib/supabase';
import { setTestMode } from '../../utils/api/api';
import { usePickleServerStore } from '../../store/usePickleServerStore';
import { useLoginTokenStore } from '../../store/useLoginTokenStore';
import type { PickleServer } from '../../constants/servers';

interface LoginApiResponse {
  resultCode: string;
  resultMessage: string;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

interface Props {
  server: PickleServer;
  onClose: () => void;
}

export default function PickleLoginModal({ server, onClose }: Props) {
  const { setServerToken } = usePickleServerStore();
  const { clearLoginToken } = useLoginTokenStore();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem(`rememberId_pickle_${server.id}`);
    if (savedId) {
      setId(savedId);
      setRemember(true);
    }
  }, [server.id]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // 웹데모: Supabase 로그인
      if (server.id === 'web-demo') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: id,
          password,
        });
        if (error || !data.session) {
          setError('로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.');
          return;
        }
        if (remember) {
          localStorage.setItem(`rememberId_pickle_${server.id}`, id);
        } else {
          localStorage.removeItem(`rememberId_pickle_${server.id}`);
        }
        setServerToken(server.id, data.session.access_token);
        toast.success('웹데모 로그인에 성공하였습니다.');
        onClose();
        return;
      }

      const testId = import.meta.env.VITE_TEST_ID;
      const testPw = import.meta.env.VITE_TEST_PW;
      if (testId && testPw && id === testId && password === testPw) {
        clearLoginToken();
        if (remember) {
          localStorage.setItem(`rememberId_pickle_${server.id}`, id);
        } else {
          localStorage.removeItem(`rememberId_pickle_${server.id}`);
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
        setServerToken(server.id, supabaseToken);
        toast.success('테스트 계정으로 로그인했습니다.');
        onClose();
        return;
      }

      const res = await axios.post<LoginApiResponse>(
        `${server.apiUrl}/admin/login`,
        { adminId: id, password },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (res.data.resultCode !== 'SUCCESS') {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      const { accessToken, refreshToken } = res.data.data;
      setServerToken(server.id, accessToken, refreshToken);

      if (server.id === 'prod') {
        supabase.auth.signInWithPassword({ email: id, password }).catch(() => {
          console.warn('Supabase 세션 연동 실패 - 일부 기능이 제한될 수 있습니다.');
        });
      }

      if (remember) {
        localStorage.setItem(`rememberId_pickle_${server.id}`, id);
      } else {
        localStorage.removeItem(`rememberId_pickle_${server.id}`);
      }

      toast.success(`Pickle ${server.label} 로그인에 성공하였습니다.`);
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
          <h2 className='text-xl font-bold text-[#1B1E2F]'>
            Pickle {server.label}
          </h2>
          <p className='text-sm text-gray-500 mt-1'>관리자 계정으로 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          {error && (
            <p className='text-red-500 text-sm text-center'>{error}</p>
          )}
          <input
            type='text'
            placeholder={server.id === 'web-demo' ? '이메일' : '아이디'}
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
