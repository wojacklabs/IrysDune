import React, { useState, useEffect } from 'react';
import { ProfileImageCacheService } from '../services/profileImageCache';

interface ProfileImageProps {
  handle: string;
  name: string;
  className?: string;
}

const ProfileImage: React.FC<ProfileImageProps> = ({ handle, name, className }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Clean handle (remove @ if present)
    const cleanHandle = handle.replace('@', '');
    
    // First, try to get cached image info
    const cachedInfo = ProfileImageCacheService.getCachedImageInfo(cleanHandle);
    
    if (cachedInfo) {
      setImageUrl(cachedInfo.imageUrl);
      setIsLoading(false);
      
      // Always try to load actual image in background
      ProfileImageCacheService.loadProfileImage(cleanHandle, true).then(newUrl => {
        // Update if we got a different (better) image
        if (newUrl !== cachedInfo.imageUrl) {
          setImageUrl(newUrl);
        }
      }).catch(error => {
        console.error(`[ProfileImage] Error loading image for @${cleanHandle}:`, error);
      });
    } else {
      // No cache, load image
      ProfileImageCacheService.loadProfileImage(cleanHandle).then(url => {
        setImageUrl(url);
        setIsLoading(false);
      }).catch(error => {
        console.error(`[ProfileImage] Error loading image for @${cleanHandle}:`, error);
        // Use fallback directly
        const colors = ['60a5fa', '8b5cf6', '10b981', 'f59e0b', 'ef4444', '6366f1'];
        const colorIndex = cleanHandle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanHandle)}&background=${colors[colorIndex]}&color=fff&size=200`;
        setImageUrl(fallbackUrl);
        setIsLoading(false);
      });
    }
  }, [handle]);
  
  if (!imageUrl) {
    return null;
  }
  
  return (
    <img 
      src={imageUrl} 
      alt={name}
      className={`${className} ${isLoading ? 'loading' : ''}`}
      title={`${name} ${handle}`}
    />
  );
};

export default ProfileImage;
