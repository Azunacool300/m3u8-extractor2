const express = require('express');
const puppeteer = require('puppeteer');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/extract', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).send('Falta el parámetro url');

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    let masterPlaylistUrl = null;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.m3u8') && !masterPlaylistUrl) {
        masterPlaylistUrl = url;
      }
    });

    await page.goto(videoUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 7000));
    await browser.close();

    if (!masterPlaylistUrl) return res.status(404).send('No se encontró .m3u8');

    https.get(masterPlaylistUrl, (m3uRes) => {
      let data = '';
      m3uRes.on('data', chunk => { data += chunk; });
      m3uRes.on('end', () => {
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
          return res.json({ m3u8: finalUrl });
        } else {
          return res.status(404).send('No se encontró calidad 720p');
        }
      });
    });

  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).send('Error al extraer el video');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
