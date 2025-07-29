export interface AppPreset {
  id: string;
  name: string;
  tags: Tag[];
  color: string;
  icon?: string;
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
}

export type ChartType = 'line' | 'stacked' | 'treemap';

export interface LoadingProgress {
  current: number;
  total: number;
  percentage: number;
}

// Chart configuration for dashboard
export interface ChartConfig {
  id: string;
  name: string; // for compatibility with AppPreset/CustomQuery
  title: string;
  description?: string;
  queries: Array<{
    id: string;
    name: string;
    tags: Tag[];
    color: string;
    isGroup?: boolean;
    groupName?: string;
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
} 