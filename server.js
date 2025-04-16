const express = require('express');
const puppeteer = require('puppeteer');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/extract', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) return res.status(400).json({ error: 'Falta el parámetro url' });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let masterPlaylistUrl = null;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('.m3u8') && !masterPlaylistUrl) {
      masterPlaylistUrl = url;
    }
  });

  try {
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36");
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 7000));
    await browser.close();

    if (!masterPlaylistUrl) return res.status(404).json({ error: 'No se encontró el archivo .m3u8' });

    https.get(masterPlaylistUrl, (m3u8Res) => {
      let data = '';

      m3u8Res.on('data', chunk => { data += chunk; });
      m3u8Res.on('end', () => {
        const lines = data.split('\n');
        let targetQualityUrl = '';

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('RESOLUTION=1280x720')) {
            targetQualityUrl = lines[i + 1];
            break;
          }
        }

        if (targetQualityUrl) {
          const baseUrl = masterPlaylistUrl.substring(0, masterPlaylistUrl.lastIndexOf('/') + 1);
          const finalUrl = targetQualityUrl.startsWith('http') ? targetQualityUrl : baseUrl + targetQualityUrl;
          return res.json({ url: finalUrl });
        } else {
          return res.status(404).json({ error: 'No se encontró calidad 720p' });
        }
      });
    });

  } catch (err) {
    await browser.close();
    return res.status(500).json({ error: 'Error al extraer el video', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
