import { Contract, JsonRpcProvider } from 'ethers';

const NFT_CONTRACT_ADDRESS = '0x5Aa61c497B4e3592cD69FC88B7303e3Aac5DA5FD';
const IRYS_TESTNET_RPC = 'https://testnet-rpc.irys.xyz/v1/execution-rpc';
const NFT_ABI = [
  'event NFTMinted(address indexed minter, uint256 indexed tokenId, string uri)',
  'function totalSupply() view returns (uint256)'
];

export async function debugBadgeMintCounts() {
  console.log('[Debug] Starting badge mint count debug...');
  
  try {
    const provider = new JsonRpcProvider(IRYS_TESTNET_RPC);
    const contract = new Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
    
    // Get total supply first
    const totalSupply = await contract.totalSupply();
    console.log('[Debug] Total NFTs minted:', totalSupply.toString());
    
    // Get ALL events from contract deployment
    const filter = contract.filters.NFTMinted();
    const events = await contract.queryFilter(filter, 0, 'latest');
    
    console.log('[Debug] Total NFTMinted events found:', events.length);
    
    const badgeDetails = new Map<string, Array<{ tokenId: string; uri: string; minter: string }>>();
    const failedMetadata: string[] = [];
    
    // Process each event
    for (const event of events) {
      if ('args' in event && event.args) {
        const [minter, tokenId, uri] = event.args;
        
        try {
          console.log(`[Debug] Fetching metadata for token #${tokenId} from: ${uri}`);
          const metadataResponse = await fetch(uri);
          
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            const badgeTypeAttr = metadata.attributes?.find((attr: any) => 
              attr.trait_type === 'Badge Type'
            );
            
            const badgeId = badgeTypeAttr?.value || 'unknown';
            
            if (!badgeDetails.has(badgeId)) {
              badgeDetails.set(badgeId, []);
            }
            
            badgeDetails.get(badgeId)!.push({
              tokenId: tokenId.toString(),
              uri,
              minter
            });
            
            console.log(`[Debug] Token #${tokenId} - Badge: ${badgeId}, Minter: ${minter}`);
          } else {
            console.error(`[Debug] Failed to fetch metadata for token #${tokenId}: ${metadataResponse.status}`);
            failedMetadata.push(uri);
          }
        } catch (error) {
          console.error(`[Debug] Error processing token #${tokenId}:`, error);
          failedMetadata.push(uri);
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Print summary
    console.log('\n[Debug] ===== BADGE MINT SUMMARY =====');
    for (const [badgeId, details] of badgeDetails.entries()) {
      console.log(`\n${badgeId}: ${details.length} minted`);
      details.forEach((detail, index) => {
        console.log(`  ${index + 1}. Token #${detail.tokenId} by ${detail.minter.slice(0, 6)}...${detail.minter.slice(-4)}`);
      });
    }
    
    if (failedMetadata.length > 0) {
      console.log('\n[Debug] Failed to fetch metadata for URIs:', failedMetadata);
    }
    
    return badgeDetails;
  } catch (error) {
    console.error('[Debug] Error in debugBadgeMintCounts:', error);
    return new Map();
  }
}

// Export to window for console access
if (typeof window !== 'undefined') {
  (window as any).debugBadgeMintCounts = debugBadgeMintCounts;
}
