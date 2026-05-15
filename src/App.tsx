import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAccessTokenStore } from './store/useAccessTokenStore';
import AuthGuard from './components/common/AuthGuard';
import Layout from './layout/Layout';

const ServiceEntryPage = lazy(
  () => import('./feature/service-entry/ServiceEntryPage')
);
const PicknowLogin = lazy(() => import('./feature/login/PicknowLogin'));
const Configuration = lazy(() => import('./feature/picknow/Configuration'));
const ChannelLayout = lazy(
  () => import('./feature/pickle/production/channel-book/ChannelLayout')
);
const CurationLayout = lazy(
  () => import('./feature/pickle/production/curation/CurationLayout')
);
const DemoCategoryLayout = lazy(
  () => import('./feature/pickle/demo/category/DemoCategoryLayout')
);
const DemoCategoryEdit = lazy(
  () => import('./feature/pickle/demo/category/DemoCategoryEdit')
);
const DemoBroadcastingLayout = lazy(
  () => import('./feature/pickle/demo/broadcasting/DemoBroadcastingLayout')
);
const DemoBroadcastingEdit = lazy(
  () => import('./feature/pickle/demo/broadcasting/DemoBroadcastingEdit')
);
const DemoCategoryAdd = lazy(
  () => import('./feature/pickle/demo/category/DemoCategoryAdd')
);
const DemoBroadcastingAdd = lazy(
  () => import('./feature/pickle/demo/broadcasting/DemoBroadcastingAdd')
);
const EpisodeLayout = lazy(
  () => import('./feature/pickle/production/episode/EpisodeLayout')
);
const ProdEpisodeDetail = lazy(
  () => import('./feature/pickle/production/episode/ProdEpisodeDetail')
);
const ProdChannelDetail = lazy(
  () => import('./feature/pickle/production/channel-book/ProdChannelDetail')
);
const ProdCurationDetail = lazy(
  () => import('./feature/pickle/production/curation/ProdCurationDetail')
);
const DemoProgramLayout = lazy(
  () => import('./feature/pickle/demo/program/DemoProgramLayout')
);
const DemoProgramEdit = lazy(
  () => import('./feature/pickle/demo/program/DemoProgramEdit')
);
const DemoProgramAdd = lazy(
  () => import('./feature/pickle/demo/program/DemoProgramAdd')
);
const DemoProgramDetail = lazy(
  () => import('./feature/pickle/demo/program/DemoProgramDetail')
);
const DemoEpisodeLayout = lazy(
  () => import('./feature/pickle/demo/episode/DemoEpisodeLayout')
);
const DemoEpisodeEdit = lazy(
  () => import('./feature/pickle/demo/episode/DemoEpisodeEdit')
);
const DemoEpisodeAdd = lazy(
  () => import('./feature/pickle/demo/episode/DemoEpisodeAdd')
);
const DemoEpisodeDetail = lazy(
  () => import('./feature/pickle/demo/episode/DemoEpisodeDetail')
);
const DemoSeriesLayout = lazy(
  () => import('./feature/pickle/demo/series/DemoSeriesLayout')
);
const DemoSeriesEdit = lazy(
  () => import('./feature/pickle/demo/series/DemoSeriesEdit')
);
const DemoSeriesAdd = lazy(
  () => import('./feature/pickle/demo/series/DemoSeriesAdd')
);
const DemoSeriesDetail = lazy(
  () => import('./feature/pickle/demo/series/DemoSeriesDetail')
);
const DemoThemeLayout = lazy(
  () => import('./feature/pickle/demo/theme/DemoThemeLayout')
);
const DemoThemeEdit = lazy(
  () => import('./feature/pickle/demo/theme/DemoThemeEdit')
);
const DemoThemeAdd = lazy(
  () => import('./feature/pickle/demo/theme/DemoThemeAdd')
);
const DemoThemeDetail = lazy(
  () => import('./feature/pickle/demo/theme/DemoThemeDetail')
);
const DemoCategoryDetail = lazy(
  () => import('./feature/pickle/demo/category/DemoCategoryDetail')
);
const DemoBroadcastingDetail = lazy(
  () => import('./feature/pickle/demo/broadcasting/DemoBroadcastingDetail')
);

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
      <Suspense fallback={<div className='h-full w-full bg-white' />}>
        <Routes>
          {/* 서비스 선택 및 로그인 (Layout 없음) */}
          <Route path='/' element={<ServiceEntryPage />} />
          <Route path='/picknow/login' element={<PicknowLogin />} />

          {/* 인증된 어드민 페이지 */}
          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              {/* Pickle - 상용 콘텐츠 */}
              <Route path='/episode-list' element={<EpisodeLayout />} />
              <Route
                path='/episode/detail/:id'
                element={<ProdEpisodeDetail />}
              />
              <Route
                path='/channel/detail/:id'
                element={<ProdChannelDetail />}
              />
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
              <Route
                path='/stg/channel-book-list'
                element={<ChannelLayout />}
              />
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
                  <Route
                    path='detail/:id'
                    element={<DemoBroadcastingDetail />}
                  />
                  <Route path=':id' element={<DemoBroadcastingEdit />} />
                  <Route path='new' element={<DemoBroadcastingAdd />} />
                </Route>
              </Route>

              {/* Picknow */}
              <Route path='/picknow/excel-sync' element={<Configuration />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
