export function acquireOperation(lockRef: React.RefObject<boolean>): boolean {
  if (lockRef.current) return false;
  lockRef.current = true;
  return true;
}
export function releaseOperation(lockRef: React.RefObject<boolean>): void {
  lockRef.current = false;
}
