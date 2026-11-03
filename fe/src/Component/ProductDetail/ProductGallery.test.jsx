import { fireEvent, render, screen } from '@testing-library/react';
import ProductGallery from './ProductGallery';
jest.mock('../../services/product.service', () => ({ resolveImageUrl: value => value || '/images/products/default.jpg' }));
const images = ['https://example.com/one.jpg', 'https://example.com/two.jpg', 'https://example.com/three.jpg'];

test('navigates all photos with arrows, thumbnails and keyboard', () => {
  render(<ProductGallery images={images} name="Xoài" />);
  expect(screen.getByAltText('Xoài — ảnh 1').getAttribute('src')).toBe(images[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Ảnh tiếp theo' }));
  expect(screen.getByAltText('Xoài — ảnh 2').getAttribute('src')).toBe(images[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh 3' }));
  expect(screen.getByAltText('Xoài — ảnh 3').getAttribute('src')).toBe(images[2]);
  fireEvent.click(screen.getByRole('button', { name: 'Ảnh tiếp theo' }));
  expect(screen.queryByAltText('Xoài — ảnh 1')).not.toBeNull();
  fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowLeft' });
  expect(screen.queryByAltText('Xoài — ảnh 3')).not.toBeNull();
});

test('supports swiping and resets when opening another product', () => {
  const { rerender } = render(<ProductGallery images={images} name="Xoài" />);
  fireEvent.touchStart(screen.getByAltText('Xoài — ảnh 1').parentElement, { touches: [{ clientX: 200 }] });
  fireEvent.touchEnd(screen.getByAltText('Xoài — ảnh 1').parentElement, { changedTouches: [{ clientX: 100 }] });
  expect(screen.queryByAltText('Xoài — ảnh 2')).not.toBeNull();
  rerender(<ProductGallery images={[]} image="https://example.com/old.jpg" name="Lúa" />);
  expect(screen.getByAltText('Lúa — ảnh 1').getAttribute('src')).toBe('https://example.com/old.jpg');
  expect(screen.queryByRole('button', { name: 'Ảnh tiếp theo' })).toBeNull();
});
