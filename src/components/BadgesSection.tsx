import React, { useState, useEffect } from 'react';
import { Award, Lock, X, AlertCircle, ExternalLink, Share2, RefreshCw } from 'lucide-react';
import { queryBadgeEligibility } from '../services/irysService';
import { ethers } from 'ethers';
import { ensureUploaderReady } from '../services/irysUploadService';
import { captureAndShare } from '../utils/captureUtils';
// import { queryMintedBadgesOnChain, queryBadgeMintCounts } from '../services/onChainService';
import { queryBadgeMintCountsFromIrys, queryMintedBadgesFromIrys } from '../services/irysMetadataCount';

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
  checkEligibility: (data: { dashboardCount: number; emailCount: number; blockDropperCount: number; tetrisCount: number; playHirysGames?: Map<string, number>; irysSlotCount?: number; irysFlipCount?: number }) => boolean;
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
  },
  
  // BridgBox Project Badges
  {
    id: 'inbox-awakening',
    name: 'Inbox Awakening',
    description: 'Decentralized Inbox about to wake up',
    image: 'https://uploader.irys.xyz/BHG5yZC2bT1KAZ6CJLyBnuWdconDCikGoMcsnUp7CdYd', // Using temporary placeholder image
    requirements: 'Available for everyone',
    project: 'BridgBox',
    checkEligibility: () => true
  },
  {
    id: 'email-adventure',
    name: 'Email Adventure',
    description: 'Exploring Decentralized Inbox',
    image: 'https://uploader.irys.xyz/G8sMUrF8yrVYJh326VkNw6eY65NnaVCHKqm6oBL3U1XW', // Using temporary placeholder image
    requirements: 'Send at least 1 email on BridgBox',
    project: 'BridgBox',
    checkEligibility: (data) => data.emailCount >= 1
  },
  {
    id: 'the-sword',
    name: 'The Sword',
    description: 'Found the legendary sword',
    image: 'https://uploader.irys.xyz/Fp9qdGf9oVL9zTyRKWrB9aznt4w3zkqujhnQ4tXhUetK', // Using temporary placeholder image
    requirements: 'Send at least 5 email on BridgBox',
    project: 'BridgBox',
    checkEligibility: (data) => data.emailCount >= 5
  },
  {
    id: 'the-hero',
    name: 'The Hero',
    description: 'Become a hero of the decentralized inbox',
    image: 'https://uploader.irys.xyz/A6CJ3HBNH1JGgAbEJDVxvC13Kh4zonGiaWUgbuiHSMzF', // Using temporary placeholder image
    requirements: 'Send at least 10 email on BridgBox',
    project: 'BridgBox',
    checkEligibility: (data) => data.emailCount >= 10
  },
  // IrysRealms Project Badges
  {
    id: 'pixel-pioneer',
    name: 'Pixel Pioneer',
    description: 'The first pixel to enter the IrysRealms',
    image: 'https://uploader.irys.xyz/617KmNNw95etYCpFdddh5RfW9fJL9GT7S5gPh8PFWDv2', // Using temporary placeholder image
    requirements: 'Available for everyone',
    project: 'IrysRealms',
    checkEligibility: () => true
  },
  {
    id: 'block-verifier',
    name: 'Block Verifier',
    description: 'Player who loves Block Dropper game',
    image: 'https://uploader.irys.xyz/Dn67oo5DqnXuYqoAUQiBzHGfFjFg6L1fE4RF3E64pocm', // Using temporary placeholder image
    requirements: 'Play and upload score of Block Dropper at least 3 times',
    project: 'IrysRealms',
    checkEligibility: (data) => data.blockDropperCount >= 3
  },
  {
    id: 'tetris-lover',
    name: 'Tetris Lover',
    description: 'Player who loves 3D Tetris game',
    image: 'https://uploader.irys.xyz/D2NBm9EoNVWMiAW3pFqxWxPUf1C2MvRWsng3mTt6tkdk', // Using temporary placeholder image
    requirements: 'Play and upload score of Tetris at least 3 times',
    project: 'IrysRealms',
    checkEligibility: (data) => data.tetrisCount >= 3
  },
  
  // PlayHirys Project Badges
  {
    id: 'playhirys-picnic',
    name: 'Enjoying Picnic with Sprite',
    description: 'Cleared Picnic with Sprite',
    image: 'https://uploader.irys.xyz/CJ2cVGz46jpLAAYBMTFQGyX5PmKKnCevySuQcSqGFWz9', // PlayHirys placeholder image
    requirements: 'Clear Picnic with Sprite at least 1 time',
    project: 'PlayHirys',
    checkEligibility: (data) => {
      if (!data.playHirysGames) return false;
      return (data.playHirysGames.get('Picnic with Sprite') || 0) >= 1;
    }
  },
  {
    id: 'playhirys-100na-easy',
    name: 'Enjoying NAS vs Sprite(EZ mode)',
    description: 'Cleared 100 NAs vs 1 Sprite (Easy)',
    image: 'https://uploader.irys.xyz/iZ5a3s9zqQhshnSzgYmtA3mgZBuHaYV4QzsoYEojUfd', // PlayHirys placeholder image
    requirements: 'Clear 100 NAs vs 1 Sprite (Easy) at least 1 time',
    project: 'PlayHirys',
    checkEligibility: (data) => {
      if (!data.playHirysGames) return false;
      return (data.playHirysGames.get('100 NAs vs 1 Sprite (Easy)') || 0) >= 1;
    }
  },
  {
    id: 'playhirys-100na-hard',
    name: 'Enjoying NAS vs Sprite(Hard mode)',
    description: 'Cleared 100 NAs vs 1 Sprite (Hard)',
    image: 'https://uploader.irys.xyz/Ge44uT8eWJhsrTzsmk6wnagTxtazrKy9Vs9zJEBPL93N', // PlayHirys placeholder image
    requirements: 'Clear 100 NAs vs 1 Sprite (Hard) at least 1 time',
    project: 'PlayHirys',
    checkEligibility: (data) => {
      if (!data.playHirysGames) return false;
      return (data.playHirysGames.get('100 NAs vs 1 Sprite (Hard)') || 0) >= 1;
    }
  },
  {
    id: 'playhirys-100na-superhard',
    name: 'Enjoying NAS vs Sprite(Super Hard mode)',
    description: 'Cleared 100 NAs vs 1 Sprite (Super Hard)',
    image: 'https://uploader.irys.xyz/djEkkfxHGd3J95HXidmyrDx2h3xHFZrz2QLaWRLp8KJ', // PlayHirys placeholder image
    requirements: 'Clear 100 NAs vs 1 Sprite (Super Hard) at least 1 time',
    project: 'PlayHirys',
    checkEligibility: (data) => {
      if (!data.playHirysGames) return false;
      return (data.playHirysGames.get('100 NAs vs 1 Sprite (Super Hard)') || 0) >= 1;
    }
  },
  {
    id: 'playhirys-bubble',
    name: 'Enjoying Bubble Sprite',
    description: 'Cleared Bubble Sprite',
    image: 'https://uploader.irys.xyz/F4HGEHPCdW6ceRkn2XYjzJzNbLhBHkjAtotKppSF41D9', // PlayHirys placeholder image
    requirements: 'Clear Bubble Sprite at least 1 time',
    project: 'PlayHirys',
    checkEligibility: (data) => {
      if (!data.playHirysGames) return false;
      return (data.playHirysGames.get('Bubble Sprite') || 0) >= 1;
    }
  },
  {
    id: 'playhirys-glide',
    name: 'Enjoying Sprite Glide',
    description: 'Cleared Sprite Glide',
    image: 'https://uploader.irys.xyz/C4SQucNdJFr6JzVUEFXQ6qonKTLctqgE5YPLu3rsSwpd', // PlayHirys placeholder image
    requirements: 'Clear Sprite Glide at least 1 time',
    project: 'PlayHirys',
    checkEligibility: (data) => {
      if (!data.playHirysGames) return false;
      return (data.playHirysGames.get('Sprite Glide') || 0) >= 1;
    }
  },
  
  // IrysSlot Project Badges
  {
    id: 'casino-newbie',
    name: 'Casino Newbie',
    description: 'Just entered the Casino',
    image: 'https://uploader.irys.xyz/DhBi8nU4K4McG2FF2KRqti3hjTYYW96HsVHfarjHWHhH', // IrysSlot placeholder image
    requirements: 'Available for everyone',
    project: 'IrysSlot',
    checkEligibility: () => true
  },
  {
    id: 'beginners-luck',
    name: 'Beginners Luck',
    description: 'Play IrysSlot at least 1 time',
    image: 'https://uploader.irys.xyz/Bde9ezKqQgb9Q7mUSKVfYgpMU8kyAtdZYFqfHmo7Mujn', // IrysSlot placeholder image
    requirements: 'Play IrysSlot at least 1 time',
    project: 'IrysSlot',
          checkEligibility: (data) => (data.irysSlotCount || 0) >= 1
  },
  {
    id: 'jackpot-hunter',
    name: 'Jackpot Hunter',
    description: 'Play IrysSlot at least 3 times',
    image: 'https://uploader.irys.xyz/B3oNTCMWS9PRsNiVEYqnmaoM5S8qk6GrmbAZi5UAhuME', // IrysSlot placeholder image
    requirements: 'Play IrysSlot at least 3 times',
    project: 'IrysSlot',
          checkEligibility: (data) => (data.irysSlotCount || 0) >= 3
  },
  {
    id: 'slot-maxi',
    name: 'Slot Maxi',
    description: 'Play IrysSlot at least 5 times',
    image: 'https://uploader.irys.xyz/3MWNacrs2Jijg5UWNPePy9mPaTrYoTs348YUdSmhzSFH', // IrysSlot placeholder image
    requirements: 'Play IrysSlot at least 5 times',
    project: 'IrysSlot',
          checkEligibility: (data) => (data.irysSlotCount || 0) >= 5
  },
  
  // IrysFlip Project Badges
  {
    id: 'flip-beginner',
    name: 'Flip Beginner',
    description: 'Just started flipping coins',
    image: 'https://uploader.irys.xyz/B3QfsVYfFibWKCeJZhFrMWHJ1tewNuEKYfctt9fRKgp6', // IrysFlip placeholder image
    requirements: 'Available for everyone',
    project: 'IrysFlip',
    checkEligibility: () => true
  },
  {
    id: 'lucky-flipper',
    name: 'Lucky Flipper',
    description: 'Placed your first bet on IrysFlip',
    image: 'https://uploader.irys.xyz/4hk9Z3ZmwZqoMBbwAd6bYehgx1FRXuoRUk7PBs719qwe', // IrysFlip placeholder image
    requirements: 'Place at least 1 bet on IrysFlip',
    project: 'IrysFlip',
    checkEligibility: (data) => (data.irysFlipCount || 0) >= 1
  },
  {
    id: 'coin-enthusiast',
    name: 'Coin Enthusiast',
    description: 'Getting the hang of coin flipping',
    image: 'https://uploader.irys.xyz/2V3926p4WL1ezwzrS8g3KXWU5CC9qb53Ne5LQWi1bZDx', // IrysFlip placeholder image
    requirements: 'Place at least 10 bets on IrysFlip',
    project: 'IrysFlip',
    checkEligibility: (data) => (data.irysFlipCount || 0) >= 5
  },
  {
    id: 'flip-master',
    name: 'Flip Master',
    description: 'Master of the coin flip',
    image: 'https://uploader.irys.xyz/Doq7ipFtYCES4CN9BeRhueqwxx33qRzKqXmUz2tzbMGH', // IrysFlip placeholder image
    requirements: 'Place at least 50 bets on IrysFlip',
    project: 'IrysFlip',
    checkEligibility: (data) => (data.irysFlipCount || 0) >= 10
  },
];

// Project metadata for sections (badges coming soon)
const PROJECT_SECTIONS = [
  {
    project: 'PlayHirys',
    description: 'Korean Irys fan made game platform',
    url: 'https://playhirys.netlify.app',
    hasBadges: true,
    comingSoon: false
  },
  {
    project: 'IrysSlot',
    description: 'Decentralized slot machine game on Irys',
    url: 'https://iryslots.xyz/',
    hasBadges: true,
    comingSoon: false
  },
  {
    project: 'IrysFlip',
    description: 'Decentralized coin flip game on Irys',
    url: 'https://irysflip.xyz/',
    hasBadges: true,
    comingSoon: false
  },
  {
    project: 'IrysDune',
    description: 'Analytics dashboard for Irys ecosystem',
    url: 'https://irys-dune.vercel.app',
    hasBadges: true
  },
  {
    project: 'BridgBox',
    description: 'Secure email bridge powered by Irys',
    url: 'https://bridgbox.cloud',
    hasBadges: true,
    comingSoon: false
  },
  {
    project: 'IrysRealms',
    description: 'An on-chain gaming world built on Irys',
    url: 'https://irysrealms.xyz/game',
    hasBadges: true,
    comingSoon: false
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
  const [emailCount, setEmailCount] = useState(0);
  const [blockDropperCount, setBlockDropperCount] = useState(0);
  const [tetrisCount, setTetrisCount] = useState(0);
  const [playHirysGames, setPlayHirysGames] = useState<Map<string, number>>(new Map());
  const [irysSlotCount, setIrysSlotCount] = useState(0);
  const [irysFlipCount, setIrysFlipCount] = useState(0);
  const [mintedBadges, setMintedBadges] = useState<string[]>([]);
  const [badgeEligibilityLoading, setBadgeEligibilityLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [_mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [mintIrysId, setMintIrysId] = useState<string | null>(null);
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

  // Function to fetch mint counts - always use Irys metadata
  const fetchMintCounts = async () => {
    console.log('[Badges] Fetching badge mint counts from Irys...');
    setMintCountsLoading(true);
    
    try {
      const counts = await queryBadgeMintCountsFromIrys();
      setBadgeMintCounts(counts);
      console.log('[Badges] Badge mint counts from Irys:', Array.from(counts.entries()));
    } catch (error) {
      console.error('[Badges] Error fetching mint counts:', error);
    } finally {
      setMintCountsLoading(false);
    }
  };

  // Fetch badge mint counts
  useEffect(() => {
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
        setEmailCount(eligibility.emailCount);
        setBlockDropperCount(eligibility.blockDropperCount);
        setTetrisCount(eligibility.tetrisCount);
        setPlayHirysGames(eligibility.playHirysGames || new Map());
        setIrysSlotCount(eligibility.irysSlotCount || 0);
        setIrysFlipCount(eligibility.irysFlipCount || 0);
        
        // Query minted badges from Irys metadata (includes pre-testnet-reset data)
        const irysBadges = await queryMintedBadgesFromIrys(walletAddress);
        
        if (irysBadges.size > 0) {
          // Use Irys data as primary source
          const mintedBadgeIds = Array.from(irysBadges.keys());
          setMintedBadges(mintedBadgeIds);
          
          // Convert to MintedBadgeDetails format
          const detailsMap = new Map<string, MintedBadgeDetails>();
          irysBadges.forEach((details, badgeId) => {
            detailsMap.set(badgeId, {
              badgeId,
              tokenId: details.tokenId,
              txHash: details.txHash,
              mintedAt: details.timestamp,
              metadataUri: details.metadataUri
            });
          });
          setMintedBadgeDetails(detailsMap);
          console.log('[Badges] Set minted badge details from Irys metadata:', Array.from(detailsMap.entries()));
        } else {
          // Fallback to eligibility data if no Irys data found
          setMintedBadges(eligibility.mintedBadges);
          
          if (eligibility.mintedBadgeDetails && eligibility.mintedBadgeDetails.size > 0) {
            const detailsMap = new Map<string, MintedBadgeDetails>();
            eligibility.mintedBadgeDetails.forEach((details, badgeId) => {
              detailsMap.set(badgeId, {
                badgeId,
                tokenId: undefined,
                txHash: details.txHash,
                mintedAt: details.timestamp,
                metadataUri: details.metadataUri
              });
            });
            setMintedBadgeDetails(detailsMap);
            console.log('[Badges] Set minted badge details from eligibility (fallback):', Array.from(detailsMap.entries()));
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
    setMintIrysId(null);

    try {
      // Check eligibility
      const isEligible = badge.checkEligibility({ dashboardCount, emailCount, blockDropperCount, tetrisCount, playHirysGames, irysSlotCount, irysFlipCount });
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
      setMintSuccess("Uploading badge metadata to Irys...");
      const metadataUri = await uploadMetadataToIrys(badge);
      
      setMintSuccess("Minting NFT badge...");

      // Mint NFT - Show clear transaction details
      const contractWithSigner = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
      
      // Clear user confirmation before transaction
      console.log(`[BadgesSection] Minting NFT for badge: ${badge.id}`);
      console.log(`[BadgesSection] Contract: ${NFT_CONTRACT_ADDRESS}`);
      console.log(`[BadgesSection] Cost: 0.1 IRYS`);
      
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

      // Extract Irys transaction ID from metadata URI
      const irysId = metadataUri.split('/').pop() || tx.hash;
      setMintIrysId(irysId);
      
      setMintSuccess(`✅ Badge minted successfully! ${tokenId ? `Token ID: #${tokenId}` : ''}\nTx: ${tx.hash.slice(0, 8)}...${tx.hash.slice(-6)}\nStorage Explorer: https://storage-explorer.irys.xyz/tx/${irysId}`);
      
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
      
      // Update badge mint count
      setBadgeMintCounts(prev => {
        const newCounts = new Map(prev);
        newCounts.set(badge.id, (newCounts.get(badge.id) || 0) + 1);
        return newCounts;
      });
      
      // Close minting modal after 3 seconds
      setTimeout(() => {
        setSelectedBadge(null);
        setMintError(null);
        setMintSuccess(null);
        setMintTxHash(null);
        setMintIrysId(null);
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>Achievement Badges</h2>
          <button
            onClick={fetchMintCounts}
            disabled={mintCountsLoading}
            title="Refresh badge counts"
            style={{
              background: 'transparent',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
              cursor: mintCountsLoading ? 'not-allowed' : 'pointer',
              opacity: mintCountsLoading ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw 
              size={20} 
              className={mintCountsLoading ? 'animate-spin' : ''}
              style={{ color: '#6b7280' }}
            />
          </button>
        </div>
        <p className="section-description">
          Collect badges to showcase your achievements across the Irys ecosystem
          <span style={{ fontSize: '0.875rem', color: '#9ca3af', marginLeft: '8px' }}>
            (showing all-time data stored on Irys)
          </span>
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
                const isEligible = badge.checkEligibility({ dashboardCount, emailCount, blockDropperCount, tetrisCount, playHirysGames, irysSlotCount, irysFlipCount });
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
              
              {/* Debug info for email count */}
              {(selectedBadge.id === 'inbox-awakening' || selectedBadge.id === 'email-adventure' || selectedBadge.id === 'the-sword' || selectedBadge.id === 'the-hero') && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  Email count: {emailCount}
                </div>
              )}
              
              {/* Debug info for game counts */}
              {selectedBadge.id === 'block-verifier' && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  Block Dropper plays: {blockDropperCount}
                </div>
              )}
              
              {selectedBadge.id === 'tetris-lover' && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  Tetris plays: {tetrisCount}
                </div>
              )}
              
              {selectedBadge.id === 'playhirys-picnic' && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  Picnic with Sprite plays: {playHirysGames.get('Picnic with Sprite') || 0}
                </div>
              )}
              
              {selectedBadge.id === 'playhirys-100na-easy' && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  100 NAs vs 1 Sprite (Easy) plays: {playHirysGames.get('100 NAs vs 1 Sprite (Easy)') || 0}
                </div>
              )}
              
              {selectedBadge.id === 'playhirys-100na-hard' && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  100 NAs vs 1 Sprite (Hard) plays: {playHirysGames.get('100 NAs vs 1 Sprite (Hard)') || 0}
                </div>
              )}
              
              {selectedBadge.id === 'playhirys-100na-superhard' && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  100 NAs vs 1 Sprite (Super Hard) plays: {playHirysGames.get('100 NAs vs 1 Sprite (Super Hard)') || 0}
                </div>
              )}
              
              {selectedBadge.id === 'playhirys-bubble' && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  Bubble Sprite plays: {playHirysGames.get('Bubble Sprite') || 0}
                </div>
              )}
              
              {selectedBadge.id === 'playhirys-glide' && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  Sprite Glide plays: {playHirysGames.get('Sprite Glide') || 0}
                </div>
              )}
              
              {/* Debug info for IrysSlot count */}
              {(selectedBadge.id === 'beginners-luck' || selectedBadge.id === 'jackpot-hunter' || selectedBadge.id === 'slot-maxi') && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  IrysSlot plays: {irysSlotCount}
                </div>
              )}
              
              {/* Debug info for IrysFlip count */}
              {(selectedBadge.id === 'lucky-flipper' || selectedBadge.id === 'coin-enthusiast' || selectedBadge.id === 'flip-master') && (
                <div className="debug-info" style={{fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem'}}>
                  IrysFlip bets: {irysFlipCount}
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
                ) : selectedBadge.checkEligibility({ dashboardCount, emailCount, blockDropperCount, tetrisCount, playHirysGames, irysSlotCount, irysFlipCount }) ? (
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
                {mintIrysId && (
                  <a 
                    href={`https://storage-explorer.irys.xyz/tx/${mintIrysId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-link"
                  >
                    View on Storage Explorer <ExternalLink size={14} />
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
                  !selectedBadge.checkEligibility({ dashboardCount, emailCount, blockDropperCount, tetrisCount, playHirysGames, irysSlotCount, irysFlipCount }) ||
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
                ) : selectedBadge.checkEligibility({ dashboardCount, emailCount, blockDropperCount, tetrisCount, playHirysGames, irysSlotCount, irysFlipCount }) ? (
                  'Mint Badge (Cost: 0.1 IRYS + gas)'
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
                  <>
                    <p>
                      <strong>Metadata: </strong>
                      <a 
                        href={`https://storage-explorer.irys.xyz/tx/${selectedMintedBadge.details.metadataUri?.split('/').pop() || ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-link"
                        style={{ wordBreak: 'break-all', fontSize: '0.75rem' }}
                      >
                        {`https://storage-explorer.irys.xyz/tx/${selectedMintedBadge.details.metadataUri?.split('/').pop() || ''}`}
                        <ExternalLink size={14} style={{ marginLeft: '4px', flexShrink: 0 }} />
                      </a>
                    </p>
                  </>
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
                  `🏆 I just earned the "${selectedMintedBadge.badge.name}" badge on IrysDune! 🎉\n\nJoin me in exploring the Irys ecosystem and earn your badges too! 🚀\n\nhttps://irys-dune.vercel.app`,
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