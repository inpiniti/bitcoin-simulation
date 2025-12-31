import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use('/api/dataroma', async (req, res, next) => {
          try {
            const cheerio = await import('cheerio');
            const fetch = (await import('node-fetch')).default || global.fetch;

            const TARGET_URL = 'https://www.dataroma.com/m/g/portfolio.php?o=c';
            console.log(`[Vite Dev] Fetching Dataroma: ${TARGET_URL}`);

            const apiResponse = await fetch(TARGET_URL);
            if (!apiResponse.ok) throw new Error(apiResponse.statusText);

            const html = await apiResponse.text();
            const $ = cheerio.load(html);
            const stocks = [];

            $('#grid tbody tr').each((i, el) => {
              const tds = $(el).find('td');
              if (tds.length < 4) return;

              const ticker = $(tds[0]).text().trim();
              const name = $(tds[1]).text().trim();
              const count = parseInt($(tds[3]).text().trim(), 10);

              if (ticker && !isNaN(count) && count >= 10) {
                stocks.push({ ticker, name, count });
              }
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ stocks }));
          } catch (e) {
            console.error(e);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      }
    }
  ],
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
