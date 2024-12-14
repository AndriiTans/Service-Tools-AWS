export function isTokenExpired(idToken) {
  const [, payloadBase64] = idToken.split('.');
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  return currentTime >= payload.exp;
}

export function getTokenRemainingTime(idToken) {
  const [, payloadBase64] = idToken.split('.');
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const remainingTime = payload.exp - currentTime; // Remaining time in seconds
  return remainingTime > 0 ? remainingTime : 0; // Ensure it doesn't return negative
}
