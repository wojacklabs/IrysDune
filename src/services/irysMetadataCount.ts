import axios from 'axios';

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

export interface IrysBadgeMetadata {
  txId: string;
  badgeId: string;
  creator: string;
  timestamp: number;
  metadataUrl: string;
}

// Query badge mint counts from Irys metadata (includes pre-testnet-reset data)
export async function queryBadgeMintCountsFromIrys(): Promise<Map<string, number>> {
  console.log('[IrysMetadataCount] Querying badge counts from Irys metadata...');
  
  const badgeCounts = new Map<string, number>();
  
  try {
    let after = "";
    let hasMore = true;
    
    while (hasMore) {
      const query = `
        query {
          transactions(
            tags: [
              { name: "App-Name", values: ["IrysDune-Badge-NFT"] },
              { name: "Type", values: ["badge-nft-metadata"] }
            ],
            first: 100,
            after: "${after}",
            order: DESC
          ) {
            edges {
              node {
                id
                tags {
                  name
                  value
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `;

      const response = await axios.post(IRYS_GRAPHQL_URL, { 
        query,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = response.data;
      
      if (!result.data?.transactions?.edges) {
        break;
      }

      const edges = result.data.transactions.edges;
      
      for (const edge of edges) {
        const tags = edge.node.tags || [];
        const badgeIdTag = tags.find((tag: any) => tag.name === 'Badge-Id');
        
        if (badgeIdTag) {
          badgeCounts.set(badgeIdTag.value, (badgeCounts.get(badgeIdTag.value) || 0) + 1);
        }
      }

      if (result.data.transactions.pageInfo.hasNextPage && edges.length > 0) {
        after = edges[edges.length - 1].cursor;
      } else {
        hasMore = false;
      }
    }
    
    console.log('[IrysMetadataCount] Badge counts from Irys:', Array.from(badgeCounts.entries()));
    return badgeCounts;
    
  } catch (error) {
    console.error('[IrysMetadataCount] Error querying Irys metadata:', error);
    return badgeCounts;
  }
}

// Query minted badges for a specific wallet from Irys metadata
export async function queryMintedBadgesFromIrys(
  walletAddress: string
): Promise<Map<string, { 
  badgeId: string; 
  txHash: string; 
  tokenId: string;
  timestamp: number; 
  metadataUri: string 
}>> {
  console.log('[IrysMetadataCount] Querying minted badges from Irys for wallet:', walletAddress);
  
  const mintedBadges = new Map<string, {
    badgeId: string;
    txHash: string;
    tokenId: string;
    timestamp: number;
    metadataUri: string;
  }>();
  
  try {
    let after = "";
    let hasMore = true;
    
    while (hasMore) {
      const query = `
        query {
          transactions(
            tags: [
              { name: "App-Name", values: ["IrysDune-Badge-NFT"] },
              { name: "Type", values: ["badge-nft-metadata"] },
              { name: "Creator", values: ["${walletAddress}"] }
            ],
            first: 100,
            after: "${after}",
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
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `;

      const response = await axios.post(IRYS_GRAPHQL_URL, { 
        query,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = response.data;
      
      if (!result.data?.transactions?.edges) {
        break;
      }

      const edges = result.data.transactions.edges;
      
      for (const edge of edges) {
        const tags = edge.node.tags || [];
        const badgeIdTag = tags.find((tag: any) => tag.name === 'Badge-Id');
        const tokenIdTag = tags.find((tag: any) => tag.name === 'Token-Id');
        
        if (badgeIdTag) {
          const badgeId = badgeIdTag.value;
          const txId = edge.node.id;
          
          mintedBadges.set(badgeId, {
            badgeId,
            txHash: txId, // Irys transaction ID
            tokenId: tokenIdTag?.value || 'N/A',
            timestamp: edge.node.timestamp * 1000, // Convert to milliseconds
            metadataUri: `https://gateway.irys.xyz/${txId}`
          });
        }
      }

      if (result.data.transactions.pageInfo.hasNextPage && edges.length > 0) {
        after = edges[edges.length - 1].cursor;
      } else {
        hasMore = false;
      }
    }
    
    console.log('[IrysMetadataCount] Found', mintedBadges.size, 'badges for wallet');
    return mintedBadges;
    
  } catch (error) {
    console.error('[IrysMetadataCount] Error querying minted badges:', error);
    return mintedBadges;
  }
}

// Export to window for debugging
if (typeof window !== 'undefined') {
  (window as any).queryBadgeMintCountsFromIrys = queryBadgeMintCountsFromIrys;
  (window as any).queryMintedBadgesFromIrys = queryMintedBadgesFromIrys;
}
