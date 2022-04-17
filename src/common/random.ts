export function generateTag() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let tag = '';
  for (let i = 0; i < 4; i++) {
    tag += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tag;
}