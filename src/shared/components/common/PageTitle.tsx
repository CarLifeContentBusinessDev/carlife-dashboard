import { Helmet } from 'react-helmet-async';
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

  return (
    <Helmet>
      <title>{getTitleByPathname(pathname)}</title>
    </Helmet>
  );
};

export default PageTitle;
