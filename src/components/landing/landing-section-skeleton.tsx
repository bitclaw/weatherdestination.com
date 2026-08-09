type LandingSectionSkeletonProps = {
  /** Reserved height in px, matched per-section to avoid a layout shift
   * (CLS) if this fallback is ever visible - see landing-page.tsx. */
  height: number;
};

export function LandingSectionSkeleton({
  height
}: LandingSectionSkeletonProps) {
  return <div aria-hidden="true" style={{ height }} />;
}
