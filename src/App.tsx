import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import AuthGuard from './shared/components/common/AuthGuard';
import PageTitle from './shared/components/common/PageTitle';
import Layout from './layout/Layout';
import { supabase } from './lib/supabase';
import { useAccessTokenStore } from './shared/store/useAccessTokenStore';

const ServiceEntryPage = lazy(
  () => import('./feature/service-entry/ServiceEntryPage')
);
const Configuration = lazy(() => import('./feature/picknow/Configuration'));
const ChannelLayout = lazy(
  () => import('./feature/pickle-prod/channel-book/ChannelLayout')
);
const CurationLayout = lazy(
  () => import('./feature/pickle-prod/curation/CurationLayout')
);
const DemoCategoryLayout = lazy(
  () => import('./feature/pickle-demo/category/DemoCategoryLayout')
);
const DemoCategoryEdit = lazy(
  () => import('./feature/pickle-demo/category/DemoCategoryEdit')
);
const DemoBroadcastingLayout = lazy(
  () => import('./feature/pickle-demo/broadcasting/DemoBroadcastingLayout')
);
const DemoBroadcastingEdit = lazy(
  () => import('./feature/pickle-demo/broadcasting/DemoBroadcastingEdit')
);
const DemoCategoryAdd = lazy(
  () => import('./feature/pickle-demo/category/DemoCategoryAdd')
);
const DemoBroadcastingAdd = lazy(
  () => import('./feature/pickle-demo/broadcasting/DemoBroadcastingAdd')
);
const EpisodeLayout = lazy(
  () => import('./feature/pickle-prod/episode/EpisodeLayout')
);
const ProdEpisodeDetail = lazy(
  () => import('./feature/pickle-prod/episode/ProdEpisodeDetail')
);
const ProdChannelDetail = lazy(
  () => import('./feature/pickle-prod/channel-book/ProdChannelDetail')
);
const ProdCurationDetail = lazy(
  () => import('./feature/pickle-prod/curation/ProdCurationDetail')
);
const DemoProgramLayout = lazy(
  () => import('./feature/pickle-demo/program/DemoProgramLayout')
);
const DemoProgramEdit = lazy(
  () => import('./feature/pickle-demo/program/DemoProgramEdit')
);
const DemoProgramAdd = lazy(
  () => import('./feature/pickle-demo/program/DemoProgramAdd')
);
const DemoProgramDetail = lazy(
  () => import('./feature/pickle-demo/program/DemoProgramDetail')
);
const DemoEpisodeLayout = lazy(
  () => import('./feature/pickle-demo/episode/DemoEpisodeLayout')
);
const DemoEpisodeEdit = lazy(
  () => import('./feature/pickle-demo/episode/DemoEpisodeEdit')
);
const DemoEpisodeAdd = lazy(
  () => import('./feature/pickle-demo/episode/DemoEpisodeAdd')
);
const DemoEpisodeDetail = lazy(
  () => import('./feature/pickle-demo/episode/DemoEpisodeDetail')
);
const DemoSeriesLayout = lazy(
  () => import('./feature/pickle-demo/series/DemoSeriesLayout')
);
const DemoSeriesEdit = lazy(
  () => import('./feature/pickle-demo/series/DemoSeriesEdit')
);
const DemoSeriesAdd = lazy(
  () => import('./feature/pickle-demo/series/DemoSeriesAdd')
);
const DemoSeriesDetail = lazy(
  () => import('./feature/pickle-demo/series/DemoSeriesDetail')
);
const DemoThemeLayout = lazy(
  () => import('./feature/pickle-demo/theme/DemoThemeLayout')
);
const DemoThemeEdit = lazy(
  () => import('./feature/pickle-demo/theme/DemoThemeEdit')
);
const DemoThemeAdd = lazy(
  () => import('./feature/pickle-demo/theme/DemoThemeAdd')
);
const DemoThemeDetail = lazy(
  () => import('./feature/pickle-demo/theme/DemoThemeDetail')
);
const DemoCategoryDetail = lazy(
  () => import('./feature/pickle-demo/category/DemoCategoryDetail')
);
const DemoBroadcastingDetail = lazy(
  () => import('./feature/pickle-demo/broadcasting/DemoBroadcastingDetail')
);
const PickSeriesWeeklyData = lazy(
  () => import('./feature/pickseries/PickSeriesWeeklyData')
);
const PickSeriesOEMData = lazy(
  () => import('./feature/pickseries/PickSeriesOEMData')
);
const LoginPage = lazy(() => import('./feature/login/LoginPage'));

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
      <PageTitle />
      <LogoutRedirectListener />
      <Suspense fallback={<div className='h-full w-full bg-white' />}>
        <Routes>
          {/* 서비스 선택 및 로그인 (Layout 없음) */}
          <Route path='' element={<ServiceEntryPage />} />
          <Route path='pickseries/login' element={<LoginPage />} />

          {/* 인증된 어드민 페이지 */}
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route path='pickle'>
                {/* Pickle - 상용 콘텐츠 */}
                <Route path='episodes'>
                  <Route path='' element={<EpisodeLayout key='prod' />} />
                  <Route
                    path='detail/:id'
                    element={<ProdEpisodeDetail key='prod' />}
                  />
                </Route>

                <Route path='channels'>
                  <Route path='' element={<ChannelLayout key='prod' />} />
                  <Route
                    path='detail/:id'
                    element={<ProdChannelDetail key='prod' />}
                  />
                </Route>

                <Route path='curations'>
                  <Route path='' element={<CurationLayout key='prod' />} />
                  <Route
                    path='detail/:id'
                    element={<ProdCurationDetail key='prod' />}
                  />
                </Route>

                <Route path='stg'>
                  <Route path='episodes'>
                    <Route path='' element={<EpisodeLayout key='stg' />} />
                    <Route
                      path='detail/:id'
                      element={<ProdEpisodeDetail key='stg' />}
                    />
                  </Route>
                  <Route path='channels'>
                    <Route path='' element={<ChannelLayout key='stg' />} />
                    <Route
                      path='detail/:id'
                      element={<ProdChannelDetail key='stg' />}
                    />
                  </Route>
                  <Route path='curations'>
                    <Route path='' element={<CurationLayout key='stg' />} />
                    <Route
                      path='detail/:id'
                      element={<ProdCurationDetail key='stg' />}
                    />
                  </Route>
                </Route>

                {/* Pickle - 데모 콘텐츠 */}
                <Route path='demo'>
                  <Route path='programs'>
                    <Route index element={<DemoProgramLayout />} />
                    <Route path='detail/:id' element={<DemoProgramDetail />} />
                    <Route path='edit/:id' element={<DemoProgramEdit />} />
                    <Route path='new' element={<DemoProgramAdd />} />
                  </Route>

                  <Route path='episodes'>
                    <Route index element={<DemoEpisodeLayout />} />
                    <Route path='detail/:id' element={<DemoEpisodeDetail />} />
                    <Route path='edit/:id' element={<DemoEpisodeEdit />} />
                    <Route path='new' element={<DemoEpisodeAdd />} />
                  </Route>

                  <Route path='series'>
                    <Route index element={<DemoSeriesLayout />} />
                    <Route path='detail/:id' element={<DemoSeriesDetail />} />
                    <Route path='edit/:id' element={<DemoSeriesEdit />} />
                    <Route path='new' element={<DemoSeriesAdd />} />
                  </Route>

                  <Route path='themes'>
                    <Route index element={<DemoThemeLayout />} />
                    <Route path='detail/:id' element={<DemoThemeDetail />} />
                    <Route path='edit/:id' element={<DemoThemeEdit />} />
                    <Route path='new' element={<DemoThemeAdd />} />
                  </Route>

                  <Route path='categories'>
                    <Route index element={<DemoCategoryLayout />} />
                    <Route path='detail/:id' element={<DemoCategoryDetail />} />
                    <Route path='edit/:id' element={<DemoCategoryEdit />} />
                    <Route path='new' element={<DemoCategoryAdd />} />
                  </Route>

                  <Route path='broadcastings'>
                    <Route index element={<DemoBroadcastingLayout />} />
                    <Route
                      path='detail/:id'
                      element={<DemoBroadcastingDetail />}
                    />
                    <Route path='edit/:id' element={<DemoBroadcastingEdit />} />
                    <Route path='new' element={<DemoBroadcastingAdd />} />
                  </Route>
                </Route>
              </Route>

              {/* Picknow */}
              <Route path='picknow'>
                <Route path='excel-sync' element={<Configuration />} />
              </Route>

              {/* PickSeries */}
              <Route path='pickseries'>
                <Route
                  path='operation/weekly'
                  element={<PickSeriesWeeklyData />}
                />
                <Route path='operation/oem' element={<PickSeriesOEMData />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
