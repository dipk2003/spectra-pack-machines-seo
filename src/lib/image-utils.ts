export const shouldBypassNextImageOptimization = (src: string) => {
  const normalizedSrc = src.trim();

  if (!normalizedSrc) {
    return false;
  }

  if (normalizedSrc.startsWith('/uploads/')) {
    return true;
  }

  if (
    normalizedSrc.startsWith('http://') ||
    normalizedSrc.startsWith('https://')
  ) {
    try {
      const imageUrl = new URL(normalizedSrc);

      // Optimize assets from the source and replacement Supabase projects.
      // Next's image cache can reuse sized responses and avoid repeatedly
      // fetching full originals from Storage.
      const isPublicSiteAsset =
        imageUrl.hostname.endsWith('.supabase.co') &&
        imageUrl.pathname.startsWith('/storage/v1/object/public/site-assets/');
      return !isPublicSiteAsset;
    } catch {
      return true;
    }
  }

  return false;
};
