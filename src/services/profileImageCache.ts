interface ProfileImageCache {
  [twitterHandle: string]: {
    imageUrl: string;
    timestamp: number;
    isValid: boolean;
    isFallback?: boolean;
  };
}

const CACHE_KEY = 'irysdune-profile-images-cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const FALLBACK_RETRY_DURATION = 5 * 60 * 1000; // 5 minutes for fallback images

export class ProfileImageCacheService {
  private static cache: ProfileImageCache = {};
  private static initialized = false;

  private static init() {
    if (this.initialized) return;
    
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        this.cache = JSON.parse(stored);
        // Clean up expired entries
        const now = Date.now();
        for (const handle in this.cache) {
          if (now - this.cache[handle].timestamp > CACHE_DURATION) {
            delete this.cache[handle];
          }
        }
        this.save();
      }
    } catch (error) {
      console.error('[ProfileImageCache] Error loading cache:', error);
      this.cache = {};
    }
    
    this.initialized = true;
  }

  private static save() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('[ProfileImageCache] Error saving cache:', error);
    }
  }

  static getCachedImageInfo(twitterHandle: string): { imageUrl: string; isFallback: boolean } | null {
    this.init();
    const cached = this.cache[twitterHandle];
    
    if (cached && cached.isValid) {
      // For fallback images, only return if within retry duration
      if (cached.isFallback && (Date.now() - cached.timestamp >= FALLBACK_RETRY_DURATION)) {
        return null;
      }
      // For real images, check normal cache duration
      if (!cached.isFallback && (Date.now() - cached.timestamp >= CACHE_DURATION)) {
        return null;
      }
      return { imageUrl: cached.imageUrl, isFallback: cached.isFallback || false };
    }
    
    return null;
  }

  static setCachedImage(twitterHandle: string, imageUrl: string, isValid: boolean, isFallback: boolean = false) {
    this.init();
    this.cache[twitterHandle] = {
      imageUrl,
      timestamp: Date.now(),
      isValid,
      isFallback
    };
    this.save();
  }

  static async preloadImage(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  static async loadProfileImage(twitterHandle: string, forceRefresh: boolean = false): Promise<string> {
    this.init();
    
    // Check cache first
    const cached = this.cache[twitterHandle];
    
    // If we have a valid non-fallback cache and not forcing refresh, return it
    if (!forceRefresh && cached && cached.isValid && !cached.isFallback && 
        (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log(`[ProfileImageCache] Returning cached real image for @${twitterHandle}`);
      return cached.imageUrl;
    }
    
    // If we have a fallback cache but it's recent, return it
    if (!forceRefresh && cached && cached.isFallback && 
        (Date.now() - cached.timestamp < FALLBACK_RETRY_DURATION)) {
      console.log(`[ProfileImageCache] Returning cached fallback image for @${twitterHandle}`);
      return cached.imageUrl;
    }

    // Try to load from unavatar.io (using /x/ for Twitter/X)
    const primaryUrl = `https://unavatar.io/x/${twitterHandle}`;
    
    // Use different colors for different handles
    const colors = ['60a5fa', '8b5cf6', '10b981', 'f59e0b', 'ef4444', '6366f1'];
    const colorIndex = twitterHandle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(twitterHandle)}&background=${colors[colorIndex]}&color=fff&size=200`;

    console.log(`[ProfileImageCache] Attempting to load real image for @${twitterHandle}`);
    
    try {
      const success = await this.preloadImage(primaryUrl);
      if (success) {
        console.log(`[ProfileImageCache] Successfully loaded real image for @${twitterHandle}`);
        this.setCachedImage(twitterHandle, primaryUrl, true, false);
        return primaryUrl;
      } else {
        console.log(`[ProfileImageCache] Failed to load real image for @${twitterHandle}, using fallback`);
      }
    } catch (error) {
      console.error(`[ProfileImageCache] Error loading image for @${twitterHandle}:`, error);
    }

    // Use fallback
    console.log(`[ProfileImageCache] Using fallback image for @${twitterHandle}`);
    this.setCachedImage(twitterHandle, fallbackUrl, true, true);
    return fallbackUrl;
  }

  static clearCache() {
    this.cache = {};
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.error('[ProfileImageCache] Error clearing cache:', error);
    }
  }
}
