/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from 'App';

it('renders router structure when accessAllowed prop is not defined', () => {
  const { container } = render(<App />);
  expect(container.querySelector('.page')).toBeInTheDocument();
});

it('renders appName header when access is allowed', () => {
  render(<App accessAllowed={true} />);
  const headerElement = screen.getByText(/appName/i);
  expect(headerElement).toBeInTheDocument();
});

it('renders password prompt when access is not allowed', () => {
  render(<App accessAllowed={false} />);
  const passwordInput = screen.getByPlaceholderText('password');
  expect(passwordInput).toBeInTheDocument();
});
