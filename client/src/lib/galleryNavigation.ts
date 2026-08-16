export function nextGalleryPhotoIndex(currentIndex: number, photoCount: number, direction: -1 | 1) {
  if (photoCount < 2) return 0;
  return (currentIndex + direction + photoCount) % photoCount;
}

export function photoSwipeDirection(startX: number, endX: number, minimumDistance = 36): -1 | 1 | null {
  const distance = endX - startX;
  if (Math.abs(distance) < minimumDistance) return null;
  return distance < 0 ? 1 : -1;
}
