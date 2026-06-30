import { create } from 'zustand';

interface AccessTokenState {
  accessToken: string;
  setAccessToken: (token: string) => void;
  clearAccessToken: () => void;
}

export const useAccessTokenStore = create<AccessTokenState>((set) => ({
  accessToken: localStorage.getItem('accessToken') || '',
  setAccessToken: (token: string) => {
    localStorage.setItem('accessToken', token);
    set({ accessToken: token });
  },
  clearAccessToken: () => {
    localStorage.removeItem('accessToken');
    set({ accessToken: '' });
  },
}));
