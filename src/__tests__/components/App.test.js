/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from 'App';

it('renders router structure when accessAllowed prop is not defined', () => {
  const { container } = render(<App />);
  expect(container.querySelector('.page')).toBeInTheDocument();
});

it('renders appName header when access is allowed', async () => {
  render(<App accessAllowed={true} />);
  const headerElement = await screen.findByText(/appName/i);
  expect(headerElement).toBeInTheDocument();
});

it('renders password prompt when access is not allowed', async () => {
  render(<App accessAllowed={false} />);
  const passwordInput = await screen.findByPlaceholderText('password');
  expect(passwordInput).toBeInTheDocument();
});
