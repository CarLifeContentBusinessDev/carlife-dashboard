import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  getGoogleToken,
  googleLogout,
  initializeGoogleAPI,
  initializeGIS,
} from '../utils/auth/auth';
import LoginPopup from '../feature/login/Login';
import Button from '../components/common/Button';
import type { LoginResponseData } from '../types/type';
import { useLoginTokenStore } from '../store/useLoginTokenStore';
import { useAccessTokenStore } from '../store/useAccessTokenStore';

const Header = () => {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const { loginToken, setLoginToken } = useLoginTokenStore();
  const { accessToken, setAccessToken, clearAccessToken } =
    useAccessTokenStore();

  useEffect(() => {
    const initGoogle = async () => {
      try {
        await initializeGoogleAPI();
        await initializeGIS();
      } catch (error) {
        console.error('Google API 초기화 실패:', error);
      }
    };
    initGoogle();
  }, []);

  const handleLogin = async () => {
    if (!accessToken) return toast.warn('관리자 로그인을 먼저 해주세요!');
    const token = await getGoogleToken();
    if (token && localStorage.getItem('accessToken')) {
      setLoginToken(token);
      toast.success('Google 로그인에 성공하였습니다.');
    }
  };

  const handlePopupLoginSuccess = (data: LoginResponseData) => {
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setShowLoginPopup(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('refreshToken');
    clearAccessToken();
    googleLogout();
    window.location.reload();
  };

  return (
    <>
      <div className='w-full h-[10%] flex justify-between items-center mb-0 px-10 bg-white'>
        <h1 className='text-3xl font-bold flex gap-4 items-center'>
          <img src='/logo.svg' alt='로고' width={40} height={40} />
          PICKLE (데모)
        </h1>
        <div className='flex gap-4'>
          {!accessToken && (
            <Button onClick={() => setShowLoginPopup(true)}>
              관리자 로그인
            </Button>
          )}
          {accessToken && (
            <Button onClick={handleLogout}>관리자 로그아웃</Button>
          )}
          {!loginToken && (
            <Button onClick={handleLogin}>Google Sheets 로그인</Button>
          )}
        </div>
      </div>
      {showLoginPopup && (
        <LoginPopup
          onClose={() => setShowLoginPopup(false)}
          onLoginSuccess={handlePopupLoginSuccess}
        />
      )}
    </>
  );
};

export default Header;
