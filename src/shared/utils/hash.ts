const encode = (input: string) => new TextEncoder().encode(input);

export const sha256 = async (input: string) => {
  const digest = await crypto.subtle.digest('SHA-256', encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
