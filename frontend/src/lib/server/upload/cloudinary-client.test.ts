import { it, expect, beforeEach, afterEach } from 'vitest';
import { cloudinaryImageUrl } from './cloudinary-client';

const ORIGINAL_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
});

afterEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = ORIGINAL_CLOUD_NAME;
});

it('always applies f_auto,q_auto (3G-friendly format/quality negotiation)', () => {
  expect(cloudinaryImageUrl('products/abc123')).toBe(
    'https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/products/abc123',
  );
});

it('appends a width cap when opts.width is given', () => {
  expect(cloudinaryImageUrl('products/abc123', { width: 400 })).toBe(
    'https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto,w_400/products/abc123',
  );
});

it('omits the width segment when opts.width is absent', () => {
  expect(cloudinaryImageUrl('products/abc123', {})).toBe(
    'https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/products/abc123',
  );
});
