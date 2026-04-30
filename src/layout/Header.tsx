import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getGoogleToken,
  googleLogout,
  initializeGoogleAPI,
  initializeGIS,
} from '../utils/auth/auth';
import Button from '../components/common/Button';
import { useLoginTokenStore } from '../store/useLoginTokenStore';
import { useAccessTokenStore } from '../store/useAccessTokenStore';
import { useServiceStore, clearServiceToken } from '../store/useServiceStore';

const SERVICE_LABELS: Record<string, string> = {
  pickle: 'Pickle Admin',
  picknow: 'Picknow Admin',
};

const Header = () => {
  const navigate = useNavigate();
  const { loginToken, setLoginToken } = useLoginTokenStore();
  const { accessToken, clearAccessToken } = useAccessTokenStore();
  const { selectedService, clearSelectedService } = useServiceStore();
  const [googleInitialized, setGoogleInitialized] = useState(false);

  useEffect(() => {
    if (selectedService !== 'pickle') return;
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
    if (!accessToken) return toast.warn('관리자 로그인을 먼저 해주세요!');
    const token = await getGoogleToken();
    if (token) {
      setLoginToken(token);
      toast.success('Google 로그인에 성공하였습니다.');
    }
  };

  const handleChangeService = () => {
    navigate('/');
  };

  const handleLogout = () => {
    if (selectedService) clearServiceToken(selectedService);
    localStorage.removeItem('refreshToken');
    clearAccessToken();
    clearSelectedService();
    if (selectedService === 'pickle') googleLogout();
    navigate('/');
  };

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

      <div className='flex gap-4'>
        <Button onClick={handleChangeService} className='bg-gray-300'>
          서비스 변경
        </Button>
        {selectedService === 'pickle' && googleInitialized && !loginToken && (
          <Button onClick={handleGoogleLogin}>Google Sheets 로그인</Button>
        )}
        <Button onClick={handleLogout}>로그아웃</Button>
      </div>
    </div>
  );
};

export default Header;
