export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Address parameter is required' });
  }

  try {


    // 오늘 날짜 계산 (UTC 기준)
    const now = new Date();
    const todayStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    // GraphQL 쿼리로 dashboard 작성 여부 확인
    // Author 태그로 쿼리 (대소문자 구분 없이 비교)
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["IrysDune"] }
            { name: "Type", values: ["dashboard"] }
          ]
          first: 100
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://uploader.irys.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const transactions = data?.data?.transactions?.edges || [];
    
    // 주소를 소문자로 변환하여 비교
    const addressLower = address.toLowerCase();
    
    // 오늘 생성된 Dashboard-ID 태그가 있는 트랜잭션 찾기 (edit 제외)
    let hasCreatedDashboardToday = false;
    let todayDashboardCount = 0;
    
    for (const edge of transactions) {
      const tags = edge.node.tags || [];
      const dashboardIdTag = tags.find(tag => tag.name === 'Dashboard-ID');
      const actionTag = tags.find(tag => tag.name === 'Action');
      const authorTag = tags.find(tag => tag.name === 'Author');
      
      // Author 태그가 일치하는지 확인 (대소문자 구분 없이)
      if (!authorTag || authorTag.value.toLowerCase() !== addressLower) {
        continue;
      }
      
      // Dashboard-ID가 있고, Action이 'create'이거나 없는 경우 (edit이 아닌 경우)
      if (dashboardIdTag && (!actionTag || actionTag.value === 'create')) {
        // timestamp 확인 (Irys timestamp는 이미 밀리초 단위)
        const transactionTime = edge.node.timestamp;
        
        if (transactionTime >= todayStart.getTime() && transactionTime < todayEnd.getTime()) {
          hasCreatedDashboardToday = true;
          todayDashboardCount++;
        }
      }
    }



    // 1 또는 0 반환
    return res.status(200).json(hasCreatedDashboardToday ? 1 : 0);

  } catch (error) {
    console.error('[API] Error checking dashboard creation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 