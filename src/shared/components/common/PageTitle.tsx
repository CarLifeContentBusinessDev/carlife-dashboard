import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DEFAULT_TITLE = 'CarLife Dashboard';

const getTitleByPathname = (pathname: string): string => {
  if (pathname.startsWith('/pickle')) return 'CarLife - Pickle';
  if (pathname.startsWith('/picknow')) return 'CarLife - Picknow';
  if (pathname.startsWith('/pickseries')) return 'CarLife - PickSeries';
  return DEFAULT_TITLE;
};

const PageTitle = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getTitleByPathname(pathname);
  }, [pathname]);

  return null;
};

export default PageTitle;
