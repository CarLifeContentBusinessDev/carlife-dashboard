export function getJwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );
    const { exp } = JSON.parse(atob(padded)) as { exp?: number };
    return exp ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const expiresAt = getJwtExpiry(token);
  return expiresAt !== null ? Date.now() >= expiresAt : true;
}
