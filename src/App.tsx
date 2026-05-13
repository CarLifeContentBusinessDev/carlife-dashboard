import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAccessTokenStore } from './store/useAccessTokenStore';
import AuthGuard from './components/common/AuthGuard';
import Layout from './layout/Layout';
import { ServiceEntryPage } from './feature/service-entry/ServiceEntryPage';
import PicknowLogin from './feature/login/PicknowLogin';
import Configuration from './feature/picknow/Configuration';
import ChannelLayout from './feature/pickle/production/channel-book/ChannelLayout';
import CurationLayout from './feature/pickle/production/curation/CurationLayout';
import DemoCategoryLayout from './feature/pickle/demo/category/DemoCategoryLayout';
import DemoCategoryEdit from './feature/pickle/demo/category/DemoCategoryEdit';
import DemoBroadcastingLayout from './feature/pickle/demo/broadcasting/DemoBroadcastingLayout';
import DemoBroadcastingEdit from './feature/pickle/demo/broadcasting/DemoBroadcastingEdit';
import DemoCategoryAdd from './feature/pickle/demo/category/DemoCategoryAdd';
import DemoBroadcastingAdd from './feature/pickle/demo/broadcasting/DemoBroadcastingAdd';
import EpisodeLayout from './feature/pickle/production/episode/EpisodeLayout';
import ProdEpisodeDetail from './feature/pickle/production/episode/ProdEpisodeDetail';
import ProdChannelDetail from './feature/pickle/production/channel-book/ProdChannelDetail';
import ProdCurationDetail from './feature/pickle/production/curation/ProdCurationDetail';
import DemoProgramLayout from './feature/pickle/demo/program/DemoProgramLayout';
import DemoProgramEdit from './feature/pickle/demo/program/DemoProgramEdit';
import DemoProgramAdd from './feature/pickle/demo/program/DemoProgramAdd';
import DemoProgramDetail from './feature/pickle/demo/program/DemoProgramDetail';
import DemoEpisodeLayout from './feature/pickle/demo/episode/DemoEpisodeLayout';
import DemoEpisodeEdit from './feature/pickle/demo/episode/DemoEpisodeEdit';
import DemoEpisodeAdd from './feature/pickle/demo/episode/DemoEpisodeAdd';
import DemoEpisodeDetail from './feature/pickle/demo/episode/DemoEpisodeDetail';
import DemoSeriesLayout from './feature/pickle/demo/series/DemoSeriesLayout';
import DemoSeriesEdit from './feature/pickle/demo/series/DemoSeriesEdit';
import DemoSeriesAdd from './feature/pickle/demo/series/DemoSeriesAdd';
import DemoSeriesDetail from './feature/pickle/demo/series/DemoSeriesDetail';
import DemoThemeLayout from './feature/pickle/demo/theme/DemoThemeLayout';
import DemoThemeEdit from './feature/pickle/demo/theme/DemoThemeEdit';
import DemoThemeAdd from './feature/pickle/demo/theme/DemoThemeAdd';
import DemoThemeDetail from './feature/pickle/demo/theme/DemoThemeDetail';
import DemoCategoryDetail from './feature/pickle/demo/category/DemoCategoryDetail';
import DemoBroadcastingDetail from './feature/pickle/demo/broadcasting/DemoBroadcastingDetail';

const LOGOUT_EVENT_NAME = 'app:logout';

function LogoutRedirectListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleLogout = () => {
      navigate('/', { replace: true });
    };

    window.addEventListener(LOGOUT_EVENT_NAME, handleLogout);
    return () => window.removeEventListener(LOGOUT_EVENT_NAME, handleLogout);
  }, [navigate]);

  return null;
}

function App() {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Pickle 서비스에서만 Supabase 세션으로 accessToken 갱신
      // (Picknow는 Supabase 미사용 / Pickle API 토큰이 있을 땐 api.ts 인터셉터가 담당)
      const selectedService = localStorage.getItem('selectedService');
      const hasPickleApiToken = !!localStorage.getItem('refreshToken');
      if (
        selectedService === 'pickle' &&
        !hasPickleApiToken &&
        session?.access_token
      ) {
        useAccessTokenStore.getState().setAccessToken(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <LogoutRedirectListener />
      <Routes>
        {/* 서비스 선택 및 로그인 (Layout 없음) */}
        <Route path='/' element={<ServiceEntryPage />} />
        <Route path='/picknow/login' element={<PicknowLogin />} />

        {/* 인증된 어드민 페이지 */}
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            {/* Pickle - 상용 콘텐츠 */}
            <Route path='/episode-list' element={<EpisodeLayout />} />
            <Route path='/episode/detail/:id' element={<ProdEpisodeDetail />} />
            <Route path='/channel/detail/:id' element={<ProdChannelDetail />} />
            <Route
              path='/curation/detail/:id'
              element={<ProdCurationDetail />}
            />
            <Route path='/channel-book-list' element={<ChannelLayout />} />
            <Route path='/curation-list' element={<CurationLayout />} />
            <Route path='/stg/episode-list' element={<EpisodeLayout />} />
            <Route
              path='/stg/episode/detail/:id'
              element={<ProdEpisodeDetail />}
            />
            <Route
              path='/stg/channel/detail/:id'
              element={<ProdChannelDetail />}
            />
            <Route
              path='/stg/curation/detail/:id'
              element={<ProdCurationDetail />}
            />
            <Route path='/stg/channel-book-list' element={<ChannelLayout />} />
            <Route path='/stg/curation-list' element={<CurationLayout />} />

            {/* Pickle - 데모 콘텐츠 */}
            <Route path='/demo'>
              <Route path='program'>
                <Route index element={<DemoProgramLayout />} />
                <Route path='detail/:id' element={<DemoProgramDetail />} />
                <Route path=':id' element={<DemoProgramEdit />} />
                <Route path='new' element={<DemoProgramAdd />} />
              </Route>

              <Route path='episode'>
                <Route index element={<DemoEpisodeLayout />} />
                <Route path='detail/:id' element={<DemoEpisodeDetail />} />
                <Route path=':id' element={<DemoEpisodeEdit />} />
                <Route path='new' element={<DemoEpisodeAdd />} />
              </Route>

              <Route path='series'>
                <Route index element={<DemoSeriesLayout />} />
                <Route path='detail/:id' element={<DemoSeriesDetail />} />
                <Route path=':id' element={<DemoSeriesEdit />} />
                <Route path='new' element={<DemoSeriesAdd />} />
              </Route>

              <Route path='theme'>
                <Route index element={<DemoThemeLayout />} />
                <Route path='detail/:id' element={<DemoThemeDetail />} />
                <Route path=':id' element={<DemoThemeEdit />} />
                <Route path='new' element={<DemoThemeAdd />} />
              </Route>

              <Route path='category'>
                <Route index element={<DemoCategoryLayout />} />
                <Route path='detail/:id' element={<DemoCategoryDetail />} />
                <Route path=':id' element={<DemoCategoryEdit />} />
                <Route path='new' element={<DemoCategoryAdd />} />
              </Route>

              <Route path='broadcasting'>
                <Route index element={<DemoBroadcastingLayout />} />
                <Route path='detail/:id' element={<DemoBroadcastingDetail />} />
                <Route path=':id' element={<DemoBroadcastingEdit />} />
                <Route path='new' element={<DemoBroadcastingAdd />} />
              </Route>
            </Route>

            {/* Picknow */}
            <Route path='/picknow/excel-sync' element={<Configuration />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
