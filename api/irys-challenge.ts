import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

interface Tag {
  name: string;
  value: string;
}

interface Transaction {
  node: {
    id: string;
    timestamp: number;
    tags: Tag[];
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
    console.log(`[API] Checking dashboard creation for address: ${address}`);

    // 오늘 날짜 계산 (UTC 기준)
    const now = new Date();
    const todayStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    console.log(`[API] Checking for dashboards created today: ${todayStart.toISOString()} - ${todayEnd.toISOString()}`);

    // GraphQL 쿼리로 dashboard 작성 여부 확인
    const query = `
      query {
        transactions(
          owners: ["${address}"]
          tags: [
            { name: "Content-Type", values: ["application/json"] }
            { name: "Application", values: ["IrysDune"] }
            { name: "Type", values: ["dashboard"] }
          ]
          first: 100
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

    const response = await axios.post(
      IRYS_GRAPHQL_URL,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    const transactions: Transaction[] = response.data?.data?.transactions?.edges || [];
    
    // 오늘 생성된 Dashboard-ID 태그가 있는 트랜잭션 찾기 (edit 제외)
    let hasCreatedDashboardToday = false;
    let todayDashboardCount = 0;
    
    for (const edge of transactions) {
      const tags = edge.node.tags || [];
      const dashboardIdTag = tags.find((tag: Tag) => tag.name === 'Dashboard-ID');
      const actionTag = tags.find((tag: Tag) => tag.name === 'Action');
      
      // Dashboard-ID가 있고, Action이 'create'이거나 없는 경우 (edit이 아닌 경우)
      if (dashboardIdTag && (!actionTag || actionTag.value === 'create')) {
        // timestamp 확인 (밀리초 단위로 변환)
        const transactionTime = edge.node.timestamp * 1000;
        
        if (transactionTime >= todayStart.getTime() && transactionTime < todayEnd.getTime()) {
          hasCreatedDashboardToday = true;
          todayDashboardCount++;
          console.log(`[API] Found dashboard created today: ${new Date(transactionTime).toISOString()}`);
        }
      }
    }

    console.log(`[API] Address ${address} has created ${todayDashboardCount} dashboard(s) today`);

    // 1 또는 0 반환
    return res.status(200).json(hasCreatedDashboardToday ? 1 : 0);

  } catch (error) {
    console.error('[API] Error checking dashboard creation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 