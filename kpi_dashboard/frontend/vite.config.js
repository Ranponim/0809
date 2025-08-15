import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // 번들 분석기 (분석 모드에서만 활성화)
    process.env.ANALYZE && visualizer({
      filename: 'dist/bundle-analysis.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 청크 크기 경고 임계값 설정 (500KB -> 300KB)
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        // 수동 청크 분할 설정 (React 안전하게 처리)
        manualChunks: (id) => {
          // Recharts 차트 라이브러리 (큰 청크를 분할)
          if (id.includes('recharts')) {
            return 'chart-vendor';
          }
          
          // Radix UI 라이브러리들 (UI 컴포넌트)
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          
          // Lucide React 아이콘들
          if (id.includes('lucide-react')) {
            return 'icon-vendor';
          }
          
          // 유틸리티 라이브러리들
          if (id.includes('date-fns') || id.includes('lodash') || id.includes('clsx') || id.includes('class-variance-authority')) {
            return 'utils-vendor';
          }
          
          // 폼 관련 라이브러리들
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'form-vendor';
          }
          
          // 애니메이션 라이브러리
          if (id.includes('framer-motion')) {
            return 'animation-vendor';
          }
          
          // React와 React-DOM은 vendor 청크에 함께 포함 (분리하지 않음)
          // Node modules를 별도로 분리
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})
