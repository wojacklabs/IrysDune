export interface AppPreset {
  id: string;
  name: string;
  tags: Tag[];
  color: string;
  icon?: string;
  additionalTags?: string[]; // For filtering purposes (e.g., Irys3D)
}

export interface Tag {
  name: string;
  value: string;
}

export interface QueryResult {
  timestamp: number;
  count: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[] | any[]; // Support both number[] and treemap data
    backgroundColor: string | ((ctx: any) => string);
    borderColor: string;
    fill?: boolean;
    [key: string]: any; // Allow additional properties for treemap
  }[];
}

export interface CustomQuery {
  id: string;
  name: string;
  tags: Tag[];
  color: string;
  isGroup?: boolean;
  groupName?: string;
  isOnChain?: boolean;
  onChainConfig?: {
    network: string;
    contractAddress: string;
    rpcUrl: string;
    abis: AbiFunction[];
    displayMode: 'combined' | 'separated';
  };
}

export type ChartType = 'line' | 'stacked' | 'treemap';
export type DataDisplayType = 'absolute' | 'cumulative';
export type ChartShape = 'line' | 'treemap';

export interface LoadingProgress {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  error?: string;
}

// 온체인 쿼리 관련 타입
export interface OnChainQuery {
  contractAddress: string;
  abis?: AbiFunction[];
  network?: string; // 'mainnet' | 'polygon' 등
  rpcUrl?: string;
  multipleContracts?: {
    contractAddress: string;
    abis: AbiFunction[];
  }[];
}

export interface AbiFunction {
  name: string;
  inputs: Array<{
    name: string;
    type: string;
    indexed?: boolean;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
  }>;
  stateMutability?: string;
  type: 'function' | 'event';
}

// 온체인 프리셋 타입
export interface OnChainPreset {
  id: string;
  name: string;
  contractAddress: string;
  network: string;
  rpcUrl: string;
  description: string;
  abis?: AbiFunction[];
  color?: string;
  icon?: string;
  // For multiple contracts (e.g., PlayHirys)
  multipleContracts?: {
    name: string;
    contractAddress: string;
    abis: AbiFunction[];
  }[];
}

// 온체인 쿼리 결과
export interface OnChainQueryResult {
  date: string;
  count: number;
  functionName?: string; // ABI가 있을 때 함수별 구분
}

// Chart configuration for dashboard
export interface ChartConfig {
  id: string;
  name: string; // for compatibility with AppPreset/CustomQuery
  title: string;
  description?: string;
  queries?: Array<{
    id: string;
    name: string;
    tags: Tag[];
    color: string;
  }>;
  chartType: ChartType;
  timePeriod: 'week' | 'month' | 'quarter' | 'year';
  // Absolute date range - fixed at creation time
  dateRange?: {
    startDate: number; // timestamp
    endDate: number; // timestamp
  };
  // Legacy support
  tags?: Tag[];
  color: string; // made required for compatibility
  queryLimit?: number; // Legacy support
  // 온체인 쿼리 지원
  onChainQuery?: OnChainQuery;
  displayMode?: 'combined' | 'separated'; // 온체인 쿼리 표시 모드
}

// Dashboard stats stored separately
export interface DashboardStats {
  dashboardId: string;
  views: number;
  likes: number;
  likedBy: string[]; // wallet addresses that liked
  viewedBy: { [walletAddress: string]: number }; // wallet -> view count
}

// Dashboard types
export interface Dashboard {
  id: string;
  name: string;
  description: string;
  author: string;
  authorAddress: string;
  charts: ChartConfig[]; // Changed from tags, chartType, timePeriod
  createdAt: number;
  updatedAt: number;
  views: number;
  likes: number;
  transactionId?: string;
  mutableAddress?: string;
  rootTxId?: string; // For managing mutable chain
  statsRootTxId?: string; // For stats mutable chain
  likedBy?: string[]; // Added for tracking who liked the dashboard
}

export interface DashboardFilter {
  searchTerm?: string;
  author?: string;
  sortBy: 'recent' | 'popular';
}

export interface IrysUploader {
  upload: (data: string | Buffer, options?: { tags?: { name: string; value: string }[] }) => Promise<{ id: string }>;
  address: string;
  getPrice?: (size: number) => Promise<any>;
  getLoadedBalance?: () => Promise<any>;
  [key: string]: any; // Allow additional properties
} 