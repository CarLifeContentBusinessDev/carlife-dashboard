import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getGoogleToken,
  initializeGoogleAPI,
  initializeGIS,
} from '../utils/auth/auth';
import Button from '../components/common/Button';
import ServerLoginModal from '../components/common/ServerLoginModal';
import PickleLoginModal from '../components/common/PickleLoginModal';
import { useLoginTokenStore } from '../store/useLoginTokenStore';
import { useAccessTokenStore } from '../store/useAccessTokenStore';
import { useServiceStore, clearServiceToken } from '../store/useServiceStore';
import { usePicknowServerStore } from '../store/usePicknowServerStore';
import { PICKNOW_SERVERS } from '../constants/servers';
import type { PicknowServer } from '../constants/servers';
import { setTestMode } from '../utils/api/api';
import { supabase } from '../lib/supabase';

const SERVICE_LABELS: Record<string, string> = {
  pickle: 'Pickle Admin',
  picknow: 'Picknow Admin',
};

const Header = () => {
  const navigate = useNavigate();
  const { loginToken, setLoginToken } = useLoginTokenStore();
  const { accessToken, clearAccessToken } = useAccessTokenStore();
  const { selectedService, clearSelectedService } = useServiceStore();
  const { serverTokens, isServerLoggedIn, clearServerToken } =
    usePicknowServerStore();
  const [googleInitialized, setGoogleInitialized] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [loginModalServer, setLoginModalServer] =
    useState<PicknowServer | null>(null);
  const [showPickleLoginModal, setShowPickleLoginModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedService) return;
    const initGoogle = async () => {
      try {
        await initializeGoogleAPI();
        await initializeGIS();
        setGoogleInitialized(true);
      } catch (error) {
        console.error('Google API 초기화 실패:', error);
      }
    };
    initGoogle();
  }, [selectedService]);

  useEffect(() => {
    if (!serverDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setServerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [serverDropdownOpen]);

  const handleGoogleLogin = async () => {
    if (selectedService === 'picknow') {
      const { selectedServerIds } = usePicknowServerStore.getState();
      if (!selectedServerIds.some((id) => isServerLoggedIn(id))) {
        return toast.warn('서버에 먼저 로그인해주세요!');
      }
    } else if (!accessToken) {
      return toast.warn('관리자 로그인을 먼저 해주세요!');
    }
    const token = await getGoogleToken();
    if (token) {
      setLoginToken(token);
      toast.success('Google 로그인에 성공하였습니다.');
    }
  };

  const handleChangeService = () => {
    clearSelectedService();
    navigate('/');
  };

  const handleLogout = () => {
    setTestMode(false);
    if (selectedService === 'picknow') {
      PICKNOW_SERVERS.forEach((server) => clearServerToken(server.id));
    } else {
      if (selectedService) clearServiceToken(selectedService);
      localStorage.removeItem('refreshToken');
      clearAccessToken();
      supabase.auth.signOut();
    }
    clearSelectedService();
    navigate('/');
  };

  const connectedCount = PICKNOW_SERVERS.filter((s) =>
    isServerLoggedIn(s.id)
  ).length;

  const serviceLabel = selectedService
    ? SERVICE_LABELS[selectedService]
    : 'CarLife Admin';

  return (
    <div className='w-full h-[10%] flex justify-between items-center mb-0 px-10 bg-white'>
      <h1 className='text-3xl font-bold flex gap-4 items-center'>
        <img
          src={
            selectedService === 'pickle'
              ? '/pickle_logo.svg'
              : '/picknow_logo.svg'
          }
          alt='로고'
          width={40}
          height={40}
        />
        {serviceLabel}
      </h1>

      <div className='flex gap-4 items-center'>
        <button
          onClick={handleChangeService}
          className='px-5 py-2 rounded-md border border-indigo-300 text-indigo-600 bg-transparent hover:bg-indigo-50 text-sm font-medium transition-colors duration-100 cursor-pointer'
        >
          서비스 변경
        </button>

        {/* Pickle: 미로그인 시 관리자 로그인 버튼 */}
        {selectedService === 'pickle' && !accessToken && (
          <Button
            onClick={() => setShowPickleLoginModal(true)}
            className='bg-indigo-600 text-white'
          >
            관리자 로그인
          </Button>
        )}

        {/* Picknow: 서버 연결 상태 드롭다운 */}
        {selectedService === 'picknow' && (
          <div className='relative' ref={dropdownRef}>
            <button
              onClick={() => setServerDropdownOpen((prev) => !prev)}
              className='flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors'
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${connectedCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              서버 연결 {connectedCount}/{PICKNOW_SERVERS.length}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${serverDropdownOpen ? 'rotate-180' : ''}`}
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>

            {serverDropdownOpen && (
              <div className='absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50'>
                {PICKNOW_SERVERS.map((server) => {
                  const connected = !!serverTokens[server.id];
                  return (
                    <div
                      key={server.id}
                      className='flex items-center gap-3 px-4 py-3 hover:bg-gray-50'
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-gray-300'}`}
                      />
                      <span className='flex-1 text-sm font-medium text-gray-700'>
                        {server.label}
                      </span>
                      <span
                        className={`text-xs ${connected ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {connected ? '연결됨' : '미연결'}
                      </span>
                      <button
                        onClick={() => {
                          if (connected) {
                            clearServerToken(server.id);
                          } else {
                            setServerDropdownOpen(false);
                            setLoginModalServer(server);
                          }
                        }}
                        className={`text-xs px-3 py-1 rounded-full border cursor-pointer transition-colors ${
                          connected
                            ? 'border-red-200 text-red-500 hover:bg-red-50'
                            : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                        }`}
                      >
                        {connected ? '해제' : '연결'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {googleInitialized && !loginToken && (
          <Button onClick={handleGoogleLogin}>Google Sheets 로그인</Button>
        )}
        <Button onClick={handleLogout}>로그아웃</Button>
      </div>

      {loginModalServer && (
        <ServerLoginModal
          server={loginModalServer}
          onClose={() => setLoginModalServer(null)}
        />
      )}

      {showPickleLoginModal && (
        <PickleLoginModal onClose={() => setShowPickleLoginModal(false)} />
      )}
    </div>
  );
};

export default Header;
