import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: false, // 자체 서명된 인증서 허용 (프록시/방화벽 SSL 인터셉션 우회)
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
      },
    },
  },
})
