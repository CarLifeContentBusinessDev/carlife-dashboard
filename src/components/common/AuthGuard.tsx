import { Navigate, Outlet } from 'react-router-dom';
import { useServiceStore } from '../../store/useServiceStore';

export default function AuthGuard() {
  const { selectedService } = useServiceStore();
  if (!selectedService) return <Navigate to='/' replace />;
  return <Outlet />;
}
