const express = require('express');
const puppeteer = require('puppeteer');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/extract', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Falta el parámetro ?url=' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    let masterPlaylistUrl = null;

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.m3u8') && !masterPlaylistUrl) {
        masterPlaylistUrl = url;
      }
    });

    await page.goto(videoUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    await browser.close();

    if (!masterPlaylistUrl) {
      return res.status(404).json({ error: 'No se encontró una URL .m3u8' });
    }

    https.get(masterPlaylistUrl, (response) => {
      let data = '';
      response.on('data', chunk => (data += chunk));
      response.on('end', () => {
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
          const finalUrl = targetQualityUrl.startsWith('http')
            ? targetQualityUrl
            : baseUrl + targetQualityUrl;

          res.json({ url_720p: finalUrl });
        } else {
          res.status(404).json({ error: 'No se encontró calidad 720p' });
        }
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al extraer el video' });
  }
});

app.get('/', (req, res) => {
  res.send('Servidor Puppeteer funcionando 🦊');
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
