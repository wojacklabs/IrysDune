import React, { useState, useEffect } from 'react';
import { Award, Lock, X, AlertCircle, ExternalLink, Share2 } from 'lucide-react';
import { queryBadgeEligibility } from '../services/irysService';
import { ethers } from 'ethers';
import { ensureUploaderReady } from '../services/irysUploadService';
import { captureAndShare } from '../utils/captureUtils';
import { queryMintedBadgesOnChain, queryBadgeMintCounts } from '../services/onChainService';

interface BadgesSectionProps {
  walletAddress: string | null;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  image: string;
  requirements: string;
  project: string;
  checkEligibility: (data: { dashboardCount: number }) => boolean;
}

interface MintedBadgeDetails {
  badgeId: string;
  tokenId?: string;
  txHash: string;
  mintedAt: number;
  metadataUri?: string;
}

// Contract configuration
const NFT_CONTRACT_ADDRESS = '0x5Aa61c497B4e3592cD69FC88B7303e3Aac5DA5FD';
const IRYS_TESTNET_RPC = 'https://testnet-rpc.irys.xyz/v1/execution-rpc';
const NFT_ABI = [
  'function publicMint(address to, string memory uri) payable',
  'function getMintPrice() pure returns (uint256)',
  'event NFTMinted(address indexed minter, uint256 indexed tokenId, string uri)'
];

const BADGES: Badge[] = [
  // IrysDune Project Badges
  {
    id: 'community-member',
    name: 'Data Rookie',
    description: 'Just joined IrysDune',
    image: 'https://uploader.irys.xyz/CPT1FxLRBifefnhLUcej5RJE8NmZzBsXdcCcEFJqnUem',
    requirements: 'Available for everyone',
    project: 'IrysDune',
    checkEligibility: () => true
  },
  {
    id: 'dashboard-creator',
    name: 'Insight Seeker',
    description: 'Started to look for patterns in IrysDune',
    image: 'https://uploader.irys.xyz/DL6sywf9WML1tAJNV9eZgCVAA88i6GHq5j1UYjXaQbBV', 
    requirements: 'Create at least 1 dashboard',
    project: 'IrysDune',
    checkEligibility: (data) => data.dashboardCount >= 1
  },
  {
    id: 'pattern-hacker',
    name: 'Pattern Hacker',
    description: 'Decoding patterns and hacking the system',
    image: 'https://uploader.irys.xyz/6SyASQcdRQDfAScbutP3jumtwRi22d42frHLyk1PuXJs', 
    requirements: 'Create at least 5 dashboard',
    project: 'IrysDune',
    checkEligibility: (data) => data.dashboardCount >= 5
  },
  {
    id: 'the-watcher',
    name: 'The Watcher',
    description: 'The One who sees everything through data',
    image: 'https://uploader.irys.xyz/HATrjaWtkmSGfz28JeEkkDxnBKGHsMSo97yv1WWCrsyc', 
    requirements: 'Create at least 10 dashboard',
    project: 'IrysDune',
    checkEligibility: (data) => data.dashboardCount >= 10
  }
];

// Project metadata for sections (badges coming soon)
const PROJECT_SECTIONS = [
  {
    project: 'IrysDune',
    description: 'Analytics dashboard for Irys ecosystem',
    url: 'https://irys-dune.vercel.app',
    hasBadges: true
  },
  {
    project: 'GitHirys',
    description: 'Decentralized code repository platform',
    url: 'https://githirys.xyz',
    hasBadges: false,
    comingSoon: true
  },
  {
    project: 'Irys Names',
    description: 'Decentralized name service for Irys',
    url: 'https://irysnameservice.xyz',
    hasBadges: false,
    comingSoon: true
  },
  {
    project: 'BridgeBox',
    description: 'Secure email bridge powered by Irys',
    url: 'https://bridgbox.cloud',
    hasBadges: false,
    comingSoon: true
  },
  {
    project: 'IrysProofBoard',
    description: 'Proof of document for Irys',
    url: 'https://irys-proofboard-1.vercel.app',
    hasBadges: false,
    comingSoon: true
  },
  {
    project: 'IrysPFP',
    description: 'Sprite PFP generator',
    url: 'https://www.irys-pfp.xyz',
    hasBadges: false,
    comingSoon: true
  },
  {
    project: 'IrysFlip',
    description: 'Coin flip game on Irys',
    url: 'https://irysflip.vercel.app',
    hasBadges: false,
    comingSoon: true
  },
  {
    project: 'IrysCrush',
    description: 'Match-3 game on Irys',
    url: 'https://iryscrush.xyz',
    hasBadges: false,
    comingSoon: true
  }
];

const BadgesSection: React.FC<BadgesSectionProps> = ({ walletAddress }) => {
  // Badge states
  const [dashboardCount, setDashboardCount] = useState(0);
  const [mintedBadges, setMintedBadges] = useState<string[]>([]);
  const [badgeEligibilityLoading, setBadgeEligibilityLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [mintedBadgeDetails, setMintedBadgeDetails] = useState<Map<string, MintedBadgeDetails>>(new Map());
  const [selectedMintedBadge, setSelectedMintedBadge] = useState<{ badge: Badge; details: MintedBadgeDetails } | null>(null);
  const [badgeMintCounts, setBadgeMintCounts] = useState<Map<string, number>>(new Map());
  const [mintCountsLoading, setMintCountsLoading] = useState(false);

  // Load minted badge details from localStorage (will be overridden by on-chain data)
  useEffect(() => {
    if (walletAddress && mintedBadgeDetails.size === 0) {
      const savedDetails = localStorage.getItem(`mintedBadgeDetails-${walletAddress}`);
      if (savedDetails) {
        try {
          const parsed = JSON.parse(savedDetails);
          setMintedBadgeDetails(new Map(Object.entries(parsed)));
          console.log('[Badges] Loaded saved badge details from localStorage:', parsed);
        } catch (error) {
          console.error('[Badges] Error loading saved badge details:', error);
        }
      }
    }
  }, [walletAddress]);

  // Save minted badge details to localStorage when they change
  useEffect(() => {
    if (walletAddress && mintedBadgeDetails.size > 0) {
      const detailsObj = Object.fromEntries(mintedBadgeDetails);
      localStorage.setItem(`mintedBadgeDetails-${walletAddress}`, JSON.stringify(detailsObj));
      console.log('[Badges] Saved badge details to localStorage');
    }
  }, [walletAddress, mintedBadgeDetails]);

  // Fetch badge mint counts
  useEffect(() => {
    const fetchMintCounts = async () => {
      console.log('[Badges] Fetching badge mint counts...');
      setMintCountsLoading(true);
      
      try {
        const counts = await queryBadgeMintCounts();
        setBadgeMintCounts(counts);
        console.log('[Badges] Badge mint counts:', Array.from(counts.entries()));
      } catch (error) {
        console.error('[Badges] Error fetching mint counts:', error);
      } finally {
        setMintCountsLoading(false);
      }
    };

    fetchMintCounts();
  }, []); // Run once on component mount

  // Fetch badge eligibility data
  useEffect(() => {
    if (!walletAddress) {
      setBadgeEligibilityLoading(false);
      return;
    }

    const fetchBadgeEligibility = async () => {
      console.log('[Badges] Fetching badge eligibility data...');
      setBadgeEligibilityLoading(true);
      
      try {
        // Query dashboard eligibility from Irys
        const eligibility = await queryBadgeEligibility(walletAddress);
        setDashboardCount(eligibility.dashboardCount);
        
        // Query actual minted badges from on-chain NFT contract
        const onChainBadges = await queryMintedBadgesOnChain(walletAddress);
        
        if (onChainBadges.size > 0) {
          // Use on-chain data as primary source
          const mintedBadgeIds = Array.from(onChainBadges.keys());
          setMintedBadges(mintedBadgeIds);
          
          // Convert to MintedBadgeDetails format
          const detailsMap = new Map<string, MintedBadgeDetails>();
          onChainBadges.forEach((details, badgeId) => {
            detailsMap.set(badgeId, {
              badgeId,
              tokenId: details.tokenId,
              txHash: details.txHash,
              mintedAt: details.timestamp,
              metadataUri: details.metadataUri
            });
          });
          setMintedBadgeDetails(detailsMap);
          console.log('[Badges] Set minted badge details from on-chain NFT contract:', Array.from(detailsMap.entries()));
        } else {
          // Fallback to Irys data if no on-chain data found
          setMintedBadges(eligibility.mintedBadges);
          
          if (eligibility.mintedBadgeDetails && eligibility.mintedBadgeDetails.size > 0) {
            const detailsMap = new Map<string, MintedBadgeDetails>();
            eligibility.mintedBadgeDetails.forEach((details, badgeId) => {
              detailsMap.set(badgeId, {
                badgeId,
                tokenId: undefined, // We don't have tokenId from Irys
                txHash: details.txHash,
                mintedAt: details.timestamp,
                metadataUri: details.metadataUri
              });
            });
            setMintedBadgeDetails(detailsMap);
            console.log('[Badges] Set minted badge details from Irys (fallback):', Array.from(detailsMap.entries()));
          }
        }
        
        console.log('[Badges] Badge eligibility:', eligibility);
      } catch (error) {
        console.error('[Badges] Error fetching badge eligibility:', error);
      } finally {
        setBadgeEligibilityLoading(false);
      }
    };

    fetchBadgeEligibility();
  }, [walletAddress]);

  // Upload metadata to Irys
  const uploadMetadataToIrys = async (badge: Badge) => {
    try {
      const uploader = await ensureUploaderReady();
      if (!uploader) {
        throw new Error("Failed to initialize Irys uploader");
      }

      const metadata = {
        name: badge.name,
        description: badge.description,
        image: badge.image,
        attributes: [
          { trait_type: "Badge Type", value: badge.id },
          { trait_type: "Project", value: badge.project },
          { trait_type: "Minted Date", value: new Date().toISOString() },
          { trait_type: "Minter", value: walletAddress }
        ]
      };

      const data = JSON.stringify(metadata);
      const tags = [
        { name: 'App-Name', value: 'IrysDune-Badge-NFT' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Type', value: 'badge-nft-metadata' },
        { name: 'Badge-Id', value: badge.id },
        { name: 'Project', value: badge.project },
        { name: 'Creator', value: walletAddress || 'unknown' }
      ];

      const result = await uploader.upload(data, { tags });
      const metadataUrl = `https://gateway.irys.xyz/${result.id}`;
      
      return metadataUrl;
    } catch (error) {
      console.error('[Badges] Error uploading metadata:', error);
      throw error;
    }
  };

  // Handle badge minting
  const handleMintBadge = async (badge: Badge) => {
    if (!walletAddress) {
      setMintError("Please connect your wallet first");
      return;
    }

    setIsMinting(true);
    setMintError(null);
    setMintSuccess(null);
    setMintTxHash(null);

    try {
      // Check eligibility
      const isEligible = badge.checkEligibility({ dashboardCount });
      if (!isEligible) {
        throw new Error("You are not eligible to mint this badge yet");
      }

      // Get wallet provider
      let provider = null;
      if (typeof window.ethereum !== 'undefined') {
        provider = window.ethereum;
      } else if (typeof (window as any).okxwallet !== 'undefined') {
        provider = (window as any).okxwallet;
      } else if (typeof (window as any).web3 !== 'undefined' && (window as any).web3.currentProvider) {
        provider = (window as any).web3.currentProvider;
      }
      
      if (!provider) {
        throw new Error("No wallet provider found. Please install MetaMask, OKX Wallet, or another Ethereum wallet");
      }

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x4F6' }], // 1270 in hex
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x4F6',
              chainName: 'Irys Testnet',
              nativeCurrency: {
                name: 'IRYS',
                symbol: 'IRYS',
                decimals: 18
              },
              rpcUrls: [IRYS_TESTNET_RPC],
              blockExplorerUrls: []
            }]
          });
        } else {
          throw switchError;
        }
      }

      // Connect to provider
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const signerAddress = await signer.getAddress();
      
      // Check network
      const network = await ethersProvider.getNetwork();
      if (network.chainId !== 1270n) {
        throw new Error('Not connected to Irys testnet. Please switch networks.');
      }
      
      // Check balance
      const balance = await ethersProvider.getBalance(signerAddress);
      const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, ethersProvider);
      const mintPrice = await contract.getMintPrice();
      
      if (balance < mintPrice) {
        throw new Error(`Insufficient funds. You need at least ${ethers.formatEther(mintPrice)} IRYS to mint this badge.`);
      }

      // Upload metadata
      setMintSuccess("Please confirm the metadata upload signature (1/2)...");
      const metadataUri = await uploadMetadataToIrys(badge);
      
      setMintSuccess("✅ Metadata uploaded successfully!\n\n🔄 A second signature is required to mint your NFT badge.\nPlease confirm the upcoming transaction (2/2)...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mint NFT
      const contractWithSigner = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
      const tx = await contractWithSigner.publicMint(signerAddress, metadataUri, {
        value: mintPrice
      });

      setMintTxHash(tx.hash);
      setMintSuccess("⏳ Minting transaction submitted. Waiting for confirmation...");

      const receipt = await tx.wait();
      
      // Get token ID from event
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contractWithSigner.interface.parseLog(log);
          return parsed?.name === 'NFTMinted';
        } catch {
          return false;
        }
      });

      let tokenId = null;
      if (mintEvent) {
        const parsed = contractWithSigner.interface.parseLog(mintEvent);
        tokenId = parsed?.args[1]?.toString();
      }

      setMintSuccess(`✅ Badge minted successfully! ${tokenId ? `Token ID: #${tokenId}` : ''}\nTx: ${tx.hash.slice(0, 8)}...${tx.hash.slice(-6)}\nExplorer: https://testnet-explorer.irys.xyz/tx/${tx.hash}`);
      
      // Add badge to minted list and store details
      setMintedBadges(prev => [...prev, badge.id]);
      
      // Store minted badge details
      const details: MintedBadgeDetails = {
        badgeId: badge.id,
        tokenId: tokenId || undefined,
        txHash: tx.hash,
        mintedAt: Date.now(),
        metadataUri: metadataUri
      };
      console.log('[Mint Success] Storing badge details:', details);
      setMintedBadgeDetails(prev => {
        const newMap = new Map(prev);
        newMap.set(badge.id, details);
        console.log('[Mint Success] Updated mintedBadgeDetails:', Array.from(newMap.entries()));
        return newMap;
      });
      
      // Close minting modal after 3 seconds
      setTimeout(() => {
        setSelectedBadge(null);
        setMintError(null);
        setMintSuccess(null);
        setMintTxHash(null);
      }, 3000);
      
    } catch (error: any) {
      console.error('[Badges] Minting error:', error);
      setMintError(error.message || 'Failed to mint badge');
    } finally {
      setIsMinting(false);
    }
  };

  // Group badges by project
  const badgesByProject = BADGES.reduce((acc, badge) => {
    if (!acc[badge.project]) {
      acc[badge.project] = [];
    }
    acc[badge.project].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  if (!walletAddress) {
    return (
      <div className="badges-section">
        <div className="empty-state">
          <Award size={48} />
          <h3>Connect Your Wallet</h3>
          <p>Please connect your wallet to view and mint badges</p>
        </div>
      </div>
    );
  }

  return (
    <div className="badges-section">
      <div className="title-badges">
        <h2>Achievement Badges</h2>
        <p className="section-description">
          Collect badges to showcase your achievements across the Irys ecosystem
        </p>
      </div>

      {/* Project sections */}
      {PROJECT_SECTIONS.map((section) => {
        const projectBadges = badgesByProject[section.project] || [];
        
        return (
          <div key={section.project} className="project-badges-section">
            <div className="project-header">
              <div>
                <h3>
                  <a 
                    href={section.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="project-link"
                  >
                    {section.project}
                    <ExternalLink size={16} className="external-link-icon" />
                  </a>
                </h3>
                <p className="project-description">{section.description}</p>
              </div>
              {section.hasBadges ? (
                <span className="badge-count">{projectBadges.length} badges</span>
              ) : (
                <span className="badge-status coming-soon">Coming Soon</span>
              )}
            </div>
          
          {!section.hasBadges ? (
            <div className="coming-soon-container">
              <div className="coming-soon-content">
                <Lock size={48} />
                <h4>Badges Coming Soon</h4>
                <p>We're working on exciting achievements for {section.project}. Stay tuned!</p>
              </div>
            </div>
          ) : badgeEligibilityLoading ? (
            <div className="badge-grid">
              {projectBadges.map((_, i) => (
                <div key={`skeleton-${section.project}-${i}`} className="badge-card skeleton">
                  <div className="badge-image-container skeleton-box"></div>
                  <div className="badge-info">
                    <div className="skeleton-text" style={{ width: '80%', height: '1.2rem', marginBottom: '0.5rem' }}></div>
                    <div className="skeleton-text" style={{ width: '100%', height: '0.875rem' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="badge-grid">
              {projectBadges.map(badge => {
                const isEligible = badge.checkEligibility({ dashboardCount });
                const isMinted = mintedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`badge-card ${isMinted ? 'minted' : isEligible ? 'eligible' : 'locked'}`}
                    onClick={() => {
                      console.log('[Badge Click] Badge:', badge.id, 'isMinted:', isMinted);
                      if (isMinted) {
                        const details = mintedBadgeDetails.get(badge.id);
                        console.log('[Badge Click] Details:', details);
                        console.log('[Badge Click] All minted badge details:', Array.from(mintedBadgeDetails.entries()));
                        
                        // Check if we have valid transaction details
                        if (!details || !details.txHash || details.txHash === 'Unknown') {
                          alert(`⚠️ 트랜잭션 정보를 찾을 수 없습니다.\n\n이 뱃지는 민팅되었지만 트랜잭션 정보가 저장되지 않았습니다.\n페이지를 새로고침하거나 다시 민팅해주세요.`);
                          return;
                        }
                        
                        setSelectedMintedBadge({ badge, details });
                      } else {
                        setSelectedBadge(badge);
                      }
                    }}
                  >
                    <div className="badge-image-container">
                      <img src={badge.image} alt={badge.name} className="badge-image" />
                    </div>
                    <div className="badge-info">
                      <h4>{badge.name}</h4>
                      <span className="badge-mint-count">
                        {mintCountsLoading ? (
                          <span className="loading-text">Loading...</span>
                        ) : (
                          <span>{badgeMintCounts.get(badge.id) || 0} minted</span>
                        )}
                      </span>
                    </div>
                    {isMinted ? (
                      <div className="badge-minted-indicator">
                        <Award size={16} />
                        <span>Minted</span>
                      </div>
                    ) : isEligible ? (
                      <div className="badge-eligible-indicator">
                        <Award size={16} />
                        <span>Eligible</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        );
      })}

      {/* Badge Minting Modal */}
      {selectedBadge && (
        <div className="modal-overlay" onClick={() => setSelectedBadge(null)}>
          <div className="badge-mint-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedBadge(null)}>
              <X size={20} />
            </button>
            
            <h3>Mint Achievement Badge</h3>
            
            <div className="badge-preview">
              <img src={selectedBadge.image} alt={selectedBadge.name} />
              <div className="badge-details">
                <h4>{selectedBadge.name}</h4>
                <p className="badge-project">{selectedBadge.project}</p>
                <p>{selectedBadge.description}</p>
              </div>
            </div>
            
            <div className="mint-info">
              <div className="mint-info-section">
                <h5>Mission</h5>
                <p>{selectedBadge.requirements}</p>
              </div>
              
              {/* Debug info for dashboard count */}
              {(selectedBadge.id === 'dashboard-creator' || selectedBadge.id === 'pattern-hacker' || selectedBadge.id === 'the-watcher') && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  Dashboard count: {dashboardCount}
                </div>
              )}
            </div>
            
            {walletAddress && (
              <div className="eligibility-status">
                {mintedBadges.includes(selectedBadge.id) ? (
                  <div className="status-message minted">
                    <Award size={18} />
                    <span>You have already minted this badge!</span>
                  </div>
                ) : selectedBadge.checkEligibility({ dashboardCount }) ? (
                  <div className="status-message eligible">
                    <Award size={18} />
                    <span>You are eligible to mint this badge!</span>
                  </div>
                ) : (
                  <div className="status-message locked">
                    <Lock size={18} />
                    <span>Requirements not met</span>
                  </div>
                )}
              </div>
            )}
            
            {mintError && (
              <div className="mint-error">
                <AlertCircle size={18} />
                <span>{mintError}</span>
              </div>
            )}
            
            {mintSuccess && (
              <div className="mint-success">
                <Award size={18} />
                <span>{mintSuccess}</span>
                {mintTxHash && (
                  <a 
                    href={`https://testnet-explorer.irys.xyz/tx/${mintTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-link"
                  >
                    View Transaction <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )}
            
            <div className="mint-actions">
              <button
                className="mint-btn"
                onClick={() => handleMintBadge(selectedBadge)}
                disabled={
                  isMinting || 
                  !walletAddress || 
                  !selectedBadge.checkEligibility({ dashboardCount }) ||
                  mintedBadges.includes(selectedBadge.id)
                }
              >
                {isMinting ? (
                  <>
                    <span className="spinner"></span>
                    <span>Minting...</span>
                  </>
                ) : mintedBadges.includes(selectedBadge.id) ? (
                  'Already Minted'
                ) : selectedBadge.checkEligibility({ dashboardCount }) ? (
                  'Mint Badge (0.1 IRYS)'
                ) : (
                  'Requirements Not Met'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Minted Badge Details Modal */}
      {selectedMintedBadge && (
        <div className="modal-overlay" onClick={() => setSelectedMintedBadge(null)}>
          <div className="badge-mint-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedMintedBadge(null)}>
              <X size={20} />
            </button>
            
            <h3>Badge Details</h3>
            
            <div className="badge-preview">
              <img src={selectedMintedBadge.badge.image} alt={selectedMintedBadge.badge.name} />
              <div className="badge-details">
                <h4>{selectedMintedBadge.badge.name}</h4>
                <p className="badge-project">{selectedMintedBadge.badge.project}</p>
                <p>{selectedMintedBadge.badge.description}</p>
              </div>
            </div>
            
            <div className="mint-info">
              <div className="mint-info-section">
                {selectedMintedBadge.details.tokenId && (
                  <p><strong>Token ID:</strong> #{selectedMintedBadge.details.tokenId}</p>
                )}
                <p><strong>Minted:</strong> {new Date(selectedMintedBadge.details.mintedAt).toLocaleDateString()}</p>
                <p><strong>Network:</strong> Irys Testnet</p>
                {selectedMintedBadge.details.txHash !== 'Unknown' && (
                  <p>
                    <strong>Explorer: </strong>
                    <a 
                      href={`https://testnet-explorer.irys.xyz/tx/${selectedMintedBadge.details.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                      style={{ wordBreak: 'break-all', fontSize: '0.75rem' }}
                    >
                      https://testnet-explorer.irys.xyz/tx/{selectedMintedBadge.details.txHash}
                      <ExternalLink size={14} style={{ marginLeft: '4px', flexShrink: 0 }} />
                    </a>
                  </p>
              )}
              </div>
            </div>
            
            <div className="mint-actions">
              <button
                className="share-btn"
                onClick={async () => {
                              // Create a temporary container for cleaner capture
            const badgePreview = document.querySelector('.badge-preview') as HTMLElement;
            if (badgePreview) {
              // Create capture container
              const captureContainer = document.createElement('div');
              captureContainer.style.cssText = `
                position: fixed;
                top: -9999px;
                left: -9999px;
                background: white;
                padding: 30px;
                border-radius: 16px;
                width: 400px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
              `;
              
              // Clone badge preview with better styling
              const clone = badgePreview.cloneNode(true) as HTMLElement;
              clone.style.margin = '0';
              clone.style.padding = '30px';
              clone.style.gap = '20px';
              clone.style.display = 'flex';
              clone.style.flexDirection = 'column';
              clone.style.alignItems = 'center';
              
              // Improve image size
              const img = clone.querySelector('img') as HTMLElement;
              if (img) {
                img.style.width = '200px';
                img.style.height = '200px';
                img.style.objectFit = 'contain';
              }
              
              // Add branding
              const brandingDiv = document.createElement('div');
              brandingDiv.style.cssText = `
                margin-top: 20px;
                text-align: center;
                color: #666;
                font-size: 14px;
              `;
              brandingDiv.textContent = 'IrysDune Achievement';
              clone.appendChild(brandingDiv);
              
              captureContainer.appendChild(clone);
              document.body.appendChild(captureContainer);
              
              try {
                const success = await captureAndShare(
                  captureContainer,
                  `🏆 I just earned the "${selectedMintedBadge.badge.name}" badge on @IrysDune! 🎉\n\nJoin me in exploring the Irys ecosystem and earn your badges too! 🚀`,
                  'IrysDune Badge'
                );
                if (success) {
                  console.log('Badge shared successfully!');
                }
              } finally {
                document.body.removeChild(captureContainer);
              }
            }
                }}
              >
                <Share2 size={18} />
                Share Badge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgesSection; 