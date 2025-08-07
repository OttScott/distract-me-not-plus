import React from 'react';
import { render, screen } from '@testing-library/react';
import { RawHTML } from 'components';

it('renders correctly with safe HTML', () => {
  const html = 'Use <b>bold text</b> and line breaks\nfor formatting';
  const { asFragment } = render(<RawHTML>{html}</RawHTML>);
  expect(asFragment()).toMatchSnapshot();
});

it('sanitizes unsafe HTML elements', () => {
  const maliciousHtml = '<script>alert("xss")</script><b>safe text</b>';
  render(<RawHTML>{maliciousHtml}</RawHTML>);

  // Should not contain script tag
  expect(screen.queryByRole('script')).toBeNull();
  // Should contain safe formatting and text
  expect(screen.getByText('safe text')).toBeInTheDocument();
});
