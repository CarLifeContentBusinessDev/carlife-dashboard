import pickleLogo from '@/assets/pickle_logo.svg';
import picknowLogo from '@/assets/picknow_logo.svg';
import pickseriesLogo from '@/assets/pickseries_logo.svg';
import type {
  PickleServer,
  PicknowServer,
  PickSeriesServer,
} from '@/constants/servers';
import {
  PICKLE_SERVERS,
  PICKNOW_SERVERS,
  PICKSERIES_SERVERS,
} from '@/constants/servers';
import { usePickSeriesServerStore } from '@/feature/pickseries/store/usePickSeriesServerStore';
import { supabase } from '@/lib/supabase';
import Button from '@/shared/components/common/Button';
import PickleLoginModal from '@/shared/components/common/PickleLoginModal';
import ServerLoginModal from '@/shared/components/common/ServerLoginModal';
import { useAccessTokenStore } from '@/shared/store/useAccessTokenStore';
import { useLoginTokenStore } from '@/shared/store/useLoginTokenStore';
import { usePickleServerStore } from '@/shared/store/usePickleServerStore';
import { usePicknowServerStore } from '@/shared/store/usePicknowServerStore';
import type { ServiceType } from '@/shared/store/useServiceStore';
import {
  clearServiceToken,
  useServiceStore,
} from '@/shared/store/useServiceStore';
import { setTestMode } from '@/shared/utils/api/api';
import {
  getGoogleToken,
  initializeGIS,
  initializeGoogleAPI,
} from '@/shared/utils/auth/auth';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const SERVICE_LABELS: Record<string, string> = {
  pickle: 'Pickle 대시보드',
  picknow: 'Picknow 대시보드',
  pickseries: 'PickSeries 통합 운영 대시보드',
};

const Header = () => {
  const navigate = useNavigate();
  const { loginToken, setLoginToken, clearLoginToken } = useLoginTokenStore();
  const { clearAccessToken } = useAccessTokenStore();
  const { selectedService, clearSelectedService } = useServiceStore();
  const {
    serverTokens: picknowTokens,
    isServerLoggedIn: isPicknowLoggedIn,
    clearServerToken: clearPicknowToken,
    setServerToken: setPicknowServerToken,
  } = usePicknowServerStore();
  const {
    serverTokens: pickleTokens,
    isServerLoggedIn: isPickleLoggedIn,
    clearServerToken: clearPickleToken,
  } = usePickleServerStore();
  const {
    serverTokens: pickSeriesTokens,
    isServerLoggedIn: isPickSeriesLoggedIn,
    clearServerToken: clearPickSeriesToken,
    setServerToken: setPickSeriesServerToken,
  } = usePickSeriesServerStore();
  const [googleInitialized, setGoogleInitialized] = useState(false);
  const [picknowDropdownOpen, setPicknowDropdownOpen] = useState(false);
  const [pickleDropdownOpen, setPickleDropdownOpen] = useState(false);
  const [pickSeriesDropdownOpen, setPickSeriesDropdownOpen] = useState(false);
  const [loginModalPicknowServer, setLoginModalPicknowServer] =
    useState<PicknowServer | null>(null);
  const [loginModalPickleServer, setLoginModalPickleServer] =
    useState<PickleServer | null>(null);
  const [loginModalPickSeriesServer, setLoginModalPickSeriesServer] =
    useState<PickSeriesServer | null>(null);
  const picknowDropdownRef = useRef<HTMLDivElement>(null);
  const pickleDropdownRef = useRef<HTMLDivElement>(null);
  const pickSeriesDropdownRef = useRef<HTMLDivElement>(null);

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
    if (!picknowDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        picknowDropdownRef.current &&
        !picknowDropdownRef.current.contains(e.target as Node)
      ) {
        setPicknowDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [picknowDropdownOpen]);

  useEffect(() => {
    if (!pickleDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickleDropdownRef.current &&
        !pickleDropdownRef.current.contains(e.target as Node)
      ) {
        setPickleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickleDropdownOpen]);

  const handleGoogleLogin = async () => {
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

  const handleGoogleLogout = () => {
    clearLoginToken();
    toast.success('Google 로그아웃에 성공하였습니다.');
  };

  const picknowConnectedCount = PICKNOW_SERVERS.filter((s) =>
    isPicknowLoggedIn(s.id)
  ).length;

  const pickleConnectedCount = PICKLE_SERVERS.filter((s) =>
    isPickleLoggedIn(s.id)
  ).length;

  const pickSeriesConnectedCount = PICKSERIES_SERVERS.filter((s) =>
    isPickSeriesLoggedIn(s.id)
  ).length;

  const handleServiceLogout = (service: ServiceType) => {
    setTestMode(false);
    if (service === 'picknow') {
      PICKNOW_SERVERS.forEach((server) => clearPicknowToken(server.id));
      clearServiceToken('picknow');
    } else if (service === 'pickle') {
      PICKLE_SERVERS.forEach((server) => clearPickleToken(server.id));
      clearServiceToken('pickle');
      supabase.auth.signOut();
    } else if (service === 'pickseries') {
      PICKSERIES_SERVERS.forEach((server) => clearPickSeriesToken(server.id));
      clearServiceToken('pickseries');
    }

    const remainingPicknowCount =
      service === 'picknow' ? 0 : picknowConnectedCount;
    const remainingPickleCount =
      service === 'pickle' ? 0 : pickleConnectedCount;
    const remainingPickSeriesCount =
      service === 'pickseries' ? 0 : pickSeriesConnectedCount;

    if (
      remainingPicknowCount === 0 &&
      remainingPickleCount === 0 &&
      remainingPickSeriesCount === 0
    ) {
      clearAccessToken();
      localStorage.removeItem('refreshToken');
    }

    if (selectedService === service) {
      clearSelectedService();
      navigate('/');
    }

    toast.success(
      service === 'picknow'
        ? 'Picknow 로그아웃에 성공하였습니다.'
        : service === 'pickle'
          ? 'Pickle 로그아웃에 성공하였습니다.'
          : 'PickSeries 로그아웃에 성공하였습니다.'
    );
  };

  const hasPicknowSession =
    selectedService === 'picknow' && picknowConnectedCount > 0;
  const hasPickleSession =
    selectedService === 'pickle' && pickleConnectedCount > 0;
  const hasPickSeriesSession =
    selectedService === 'pickseries' && pickSeriesConnectedCount > 0;

  const serviceLabel = selectedService
    ? SERVICE_LABELS[selectedService]
    : 'CarLife Admin';
  const [serviceLabelFirstWord, ...serviceLabelRestWords] =
    serviceLabel.split(' ');
  const serviceLabelRest = serviceLabelRestWords.join(' ');

  return (
    <div className='w-full min-h-18 py-3 flex justify-between items-center mb-0 px-10 bg-white'>
      <h1 className='text-xl font-bold flex gap-4 items-center'>
        <img
          src={
            selectedService === 'pickle'
              ? pickleLogo
              : selectedService === 'picknow'
                ? picknowLogo
                : pickseriesLogo
          }
          alt='로고'
          width={40}
          height={40}
        />
        <span className='whitespace-nowrap min-w-40'>
          {serviceLabelFirstWord}
          {serviceLabelRest && (
            <span className='hidden md:inline'> {serviceLabelRest}</span>
          )}
        </span>
      </h1>

      <div className='flex gap-4 items-center'>
        <button
          onClick={handleChangeService}
          className='shrink-0 whitespace-nowrap px-5 py-2 rounded-md border border-indigo-300 text-indigo-600 bg-white hover:bg-indigo-50 text-sm font-medium transition-colors duration-100 cursor-pointer'
        >
          서비스 변경
        </button>

        {/* Pickle: 서버 연결 상태 드롭다운 */}
        {selectedService === 'pickle' && (
          <div className='relative' ref={pickleDropdownRef}>
            <button
              onClick={() => setPickleDropdownOpen((prev) => !prev)}
              className='shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors'
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${pickleConnectedCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              서버 연결 {pickleConnectedCount}/{PICKLE_SERVERS.length}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${pickleDropdownOpen ? 'rotate-180' : ''}`}
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

            {pickleDropdownOpen && (
              <div className='absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50'>
                {PICKLE_SERVERS.map((server) => {
                  const connected = !!pickleTokens[server.id];
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
                            clearPickleToken(server.id);
                          } else {
                            setPickleDropdownOpen(false);
                            setLoginModalPickleServer(server);
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

        {/* Picknow: 서버 연결 상태 드롭다운 */}
        {selectedService === 'picknow' && (
          <div className='relative' ref={picknowDropdownRef}>
            <button
              onClick={() => setPicknowDropdownOpen((prev) => !prev)}
              className='shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors'
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${picknowConnectedCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              서버 연결 {picknowConnectedCount}/{PICKNOW_SERVERS.length}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${picknowDropdownOpen ? 'rotate-180' : ''}`}
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

            {picknowDropdownOpen && (
              <div className='absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50'>
                {PICKNOW_SERVERS.map((server) => {
                  const connected = !!picknowTokens[server.id];
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
                            clearPicknowToken(server.id);
                          } else {
                            setPicknowDropdownOpen(false);
                            setLoginModalPicknowServer(server);
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

        {/* PickSeries: 서버 연결 상태 드롭다운 */}
        {selectedService === 'pickseries' && (
          <div className='relative' ref={pickSeriesDropdownRef}>
            <button
              onClick={() => setPickSeriesDropdownOpen((prev) => !prev)}
              className='shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors'
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${pickSeriesConnectedCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              서버 연결 {pickSeriesConnectedCount}/{PICKSERIES_SERVERS.length}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${pickSeriesDropdownOpen ? 'rotate-180' : ''}`}
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

            {pickSeriesDropdownOpen && (
              <div className='absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50'>
                {PICKSERIES_SERVERS.map((server) => {
                  const connected = !!pickSeriesTokens[server.id];
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
                            clearPickSeriesToken(server.id);
                          } else {
                            setPickSeriesDropdownOpen(false);
                            setLoginModalPickSeriesServer(server);
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

        {googleInitialized && loginToken ? (
          <Button
            onClick={handleGoogleLogout}
            className='hidden lg:inline-flex'
          >
            Google 로그아웃
          </Button>
        ) : (
          googleInitialized && (
            <Button
              onClick={handleGoogleLogin}
              className='hidden lg:inline-flex'
            >
              Google 로그인
            </Button>
          )
        )}
        {hasPicknowSession && (
          <Button
            onClick={() => handleServiceLogout('picknow')}
            className='hidden lg:inline-flex'
          >
            Picknow 로그아웃
          </Button>
        )}
        {hasPickleSession && (
          <Button
            onClick={() => handleServiceLogout('pickle')}
            className='hidden lg:inline-flex'
          >
            Pickle 로그아웃
          </Button>
        )}
        {hasPickSeriesSession && (
          <Button
            onClick={() => handleServiceLogout('pickseries')}
            className='hidden lg:inline-flex'
          >
            PickSeries 로그아웃
          </Button>
        )}
      </div>

      {loginModalPicknowServer && (
        <ServerLoginModal
          server={loginModalPicknowServer}
          setServerToken={setPicknowServerToken}
          onClose={() => setLoginModalPicknowServer(null)}
        />
      )}

      {loginModalPickleServer && (
        <PickleLoginModal
          server={loginModalPickleServer}
          onClose={() => setLoginModalPickleServer(null)}
        />
      )}

      {loginModalPickSeriesServer && (
        <ServerLoginModal
          server={loginModalPickSeriesServer}
          setServerToken={setPickSeriesServerToken}
          onClose={() => setLoginModalPickSeriesServer(null)}
        />
      )}
    </div>
  );
};

export default Header;
