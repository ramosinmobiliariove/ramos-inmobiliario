module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query || {};

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'La URL enviada no es válida' });
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `El portal respondió con estado ${response.status}`,
      });
    }

    const html = await response.text();

    const getMeta = (prop) => {
      const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        'i'
      );
      const match = html.match(regex);
      return match ? match[1] : '';
    };

    const rawTitle =
      getMeta('og:title') ||
      getMeta('twitter:title') ||
      (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '');

    const rawDescription =
      getMeta('og:description') ||
      getMeta('twitter:description') ||
      getMeta('description') ||
      '';

    const ogImages = [
      ...html.matchAll(
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi
      ),
    ].map((m) => m[1]);

    const imgTags = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(
      (m) => m[1]
    );

    const normalizarUrl = (src) => {
      if (!src || src.startsWith('data:')) return null;
      try {
        return new URL(src, parsedUrl.origin).toString();
      } catch {
        return null;
      }
    };

    const fotos = [
      ...new Set(
        [...ogImages, ...imgTags]
          .map(normalizarUrl)
          .filter(Boolean)
          .filter((link) => !/logo|icon|sprite|avatar|pixel|tracker/i.test(link))
      ),
    ].slice(0, 15);

    return res.status(200).json({
      titulo: rawTitle.trim(),
      descripcion: rawDescription.trim(),
      fotos,
    });
  } catch (error) {
    return res.status(500).json({
      error:
        'No se pudo leer el enlace automáticamente. Puedes copiar los datos manualmente.',
    });
  }
};
