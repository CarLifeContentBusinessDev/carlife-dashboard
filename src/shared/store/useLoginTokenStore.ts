import { create } from 'zustand';

interface LoginTokenState {
  loginToken: string;
  setLoginToken: (token: string) => void;
  clearLoginToken: () => void;
}

export const useLoginTokenStore = create<LoginTokenState>((set) => ({
  loginToken: localStorage.getItem('googleAccessToken') || '',
  setLoginToken: (token: string) => {
    localStorage.setItem('googleAccessToken', token);
    set({ loginToken: token });
  },
  clearLoginToken: () => {
    localStorage.removeItem('googleAccessToken');
    set({ loginToken: '' });
  },
}));
