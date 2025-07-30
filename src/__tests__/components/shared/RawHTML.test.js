import React from 'react';
import { render } from '@testing-library/react';
import { RawHTML } from 'components';

it('renders correctly with safe HTML', () => {
  const html = 'Use <b>bold text</b> and line breaks\nfor formatting';
  const { asFragment } = render(<RawHTML>{html}</RawHTML>);
  expect(asFragment()).toMatchSnapshot();
});

it('sanitizes unsafe HTML elements', () => {
  const maliciousHtml = '<script>alert("xss")</script><b>safe text</b>';
  const { container } = render(<RawHTML>{maliciousHtml}</RawHTML>);

  // Should not contain script tag
  expect(container.querySelector('script')).toBeNull();
  // Should contain safe formatting
  expect(container.querySelector('b')).not.toBeNull();
  expect(container.textContent).toContain('safe text');
});
