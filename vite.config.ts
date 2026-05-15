import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    headers: {
      // Google OAuth 팝업이 window.opener를 통해 토큰을 전달할 수 있도록
      // 개발 서버에서는 unsafe-none 사용 (배포는 vercel.json에서 same-origin-allow-popups 유지)
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
});
