// import axios from 'axios';
// import { toast } from 'react-toastify';

// const api = axios.create({
//   baseURL: 'https://pickle.obigo.ai',
// });

// api.interceptors.request.use(
//   (config) => {
//     const accessToken = localStorage.getItem('accessToken');
//     if (accessToken) {
//       config.headers.Authorization = `Bearer ${accessToken}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// api.interceptors.response.use((response) => {
//   const { resultCode } = response.data;
//   if (resultCode === 'E0123') {
//     localStorage.removeItem('accessToken');

//     toast.error('로그인 토큰이 만료되었습니다. 다시 로그인해주세요.');
//   }

//   return response;
// });

// export { api };

import axios from 'axios';
import { toast } from 'react-toastify';

function createApiInstance(baseURL: string) {
  const instance = axios.create({ baseURL });

  instance.interceptors.request.use(
    (config) => {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use((response) => {
    const { resultCode } = response.data;
    if (resultCode === 'E0123') {
      localStorage.removeItem('accessToken');
      toast.error('로그인 토큰이 만료되었습니다. 다시 로그인해주세요.');
    }
    return response;
  });

  return instance;
}

export const api = createApiInstance(import.meta.env.VITE_PROD_API_URL);
export const stgApi = createApiInstance(import.meta.env.VITE_STG_API_URL);
