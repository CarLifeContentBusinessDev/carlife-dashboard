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
import PickSeriesLoginModal from '@/feature/pickseries/components/PickSeriesLoginModal';
import ServerConnectionDropdown from '@/layout/components/ServerConnectionDropdown';
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
import { useEffect, useState } from 'react';
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
  const [loginModalPicknowServer, setLoginModalPicknowServer] =
    useState<PicknowServer | null>(null);
  const [loginModalPickleServer, setLoginModalPickleServer] =
    useState<PickleServer | null>(null);
  const [loginModalPickSeriesServer, setLoginModalPickSeriesServer] =
    useState<PickSeriesServer | null>(null);
  const [showPickSeriesLoginModal, setShowPickSeriesLoginModal] =
    useState(false);

  useEffect(() => {
    if (!selectedService || selectedService === 'pickseries') return;
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
    <div className='w-full min-h-18 py-3 flex justify-between items-center mb-0 px-5 bg-white'>
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
          <span className='text-red-500'> (팀 내부용)</span>
        </span>
      </h1>

      <div className='flex gap-4 items-center'>
        <button
          onClick={handleChangeService}
          className='shrink-0 whitespace-nowrap px-5 py-2 rounded-md border border-indigo-300 text-indigo-600 bg-white hover:bg-indigo-50 text-sm font-medium transition-colors duration-100 cursor-pointer'
        >
          서비스 변경
        </button>

        {/* 서버 연결 상태 드롭다운 */}
        {selectedService === 'pickle' && (
          <ServerConnectionDropdown
            servers={PICKLE_SERVERS}
            serverTokens={pickleTokens}
            clearServerToken={clearPickleToken}
            onRequestLogin={setLoginModalPickleServer}
            menuWidthClassName='w-64'
          />
        )}

        {selectedService === 'picknow' && (
          <ServerConnectionDropdown
            servers={PICKNOW_SERVERS}
            serverTokens={picknowTokens}
            clearServerToken={clearPicknowToken}
            onRequestLogin={setLoginModalPicknowServer}
          />
        )}

        {selectedService === 'pickseries' && !hasPickSeriesSession && (
          <>
            <Button
              onClick={() => setShowPickSeriesLoginModal(true)}
              className='hidden lg:inline-flex'
            >
              PickSeries 로그인
            </Button>
          </>
        )}

        {/* 구글 로그인 버튼  */}
        {selectedService == 'pickle' &&
          (googleInitialized && loginToken ? (
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
          ))}

        {/* 서비스별 로그아웃 버튼 */}
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
          <>
            <ServerConnectionDropdown
              servers={PICKSERIES_SERVERS}
              serverTokens={pickSeriesTokens}
              clearServerToken={clearPickSeriesToken}
              onRequestLogin={setLoginModalPickSeriesServer}
              connectedActionLabel='해제'
              disconnectedActionLabel='연결'
            />
            <Button
              onClick={() => handleServiceLogout('pickseries')}
              className='hidden lg:inline-flex'
            >
              PickSeries 로그아웃
            </Button>
          </>
        )}
      </div>

      {/* 서비스별 로그인 모달 */}
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

      {showPickSeriesLoginModal && (
        <PickSeriesLoginModal
          setServerToken={setPickSeriesServerToken}
          onClose={() => setShowPickSeriesLoginModal(false)}
        />
      )}
    </div>
  );
};

export default Header;
