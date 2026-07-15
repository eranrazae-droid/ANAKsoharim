// פרוקסי שרת ל-data.gov.il — עוקף חסימת CORS של הדפדפן
// קריאה: /.netlify/functions/govproxy?resource=<resource_id>&q=<plate>
const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'autodealer-proxy' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const p = (event && event.queryStringParameters) || {};
  const resource = p.resource, q = p.q;
  if (!resource || !q) {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'missing resource/q' };
  }
  const url = 'https://data.gov.il/api/3/action/datastore_search?resource_id=' +
    encodeURIComponent(resource) + '&q=' + encodeURIComponent(q);
  try {
    const r = await fetchUrl(url);
    return {
      statusCode: r.status || 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: r.body
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(e) })
    };
  }
};
