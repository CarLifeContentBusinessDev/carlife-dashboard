import { Navigate, Outlet } from 'react-router-dom';
import { useServiceStore, getServiceToken } from '../../store/useServiceStore';

export default function AuthGuard() {
  const { selectedService } = useServiceStore();

  if (!selectedService) return <Navigate to='/' replace />;

  const serviceToken = getServiceToken(selectedService);
  if (!serviceToken) return <Navigate to={`/${selectedService}/login`} replace />;

  return <Outlet />;
}
