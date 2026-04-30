import { Navigate, Outlet } from 'react-router-dom';
import { useServiceStore } from '../../store/useServiceStore';
import { useAccessTokenStore } from '../../store/useAccessTokenStore';

export default function AuthGuard() {
  const { selectedService } = useServiceStore();
  const { accessToken } = useAccessTokenStore();

  if (!selectedService) return <Navigate to='/' replace />;
  if (!accessToken) return <Navigate to={`/${selectedService}/login`} replace />;

  return <Outlet />;
}
