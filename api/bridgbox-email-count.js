export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Address parameter is required' });
  }

  try {
    console.log(`[Proxy] Fetching BridgBox email count for address: ${address}`);
    
    const response = await fetch(
      `https://app.bridgbox.cloud/api/sent-email-count?address=${address}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`BridgBox API returned status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Proxy] BridgBox API response:`, data);

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Proxy] Error fetching from BridgBox API:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch email count',
      details: error.message 
    });
  }
}
