/**
 * Largest picture the lobby display stores. The live site keeps pictures as
 * base64 text in D1, which holds one value of up to 2,000,000 bytes;
 * 1,400,000 bytes is 1,866,668 characters of base64. Shared by the upload
 * route and the page that shrinks photos before sending them.
 */
export const MAX_DISPLAY_PHOTO_BYTES = 1_400_000;
