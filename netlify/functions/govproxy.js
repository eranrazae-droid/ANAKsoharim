// פרוקסי שרת ל-data.gov.il — עוקף חסימת CORS של הדפדפן
// קריאה: /.netlify/functions/govproxy?resource=<resource_id>&q=<plate>
exports.handler = async (event) => {
  const p = (event && event.queryStringParameters) || {};
  const resource = p.resource, q = p.q;
  if (!resource || !q) {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'missing resource/q' };
  }
  const url = 'https://data.gov.il/api/3/action/datastore_search?resource_id=' +
    encodeURIComponent(resource) + '&q=' + encodeURIComponent(q);
  try {
    const r = await fetch(url);
    const txt = await r.text();
    return {
      statusCode: r.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: txt
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: String(e) })
    };
  }
};
