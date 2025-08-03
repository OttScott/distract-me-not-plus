import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { PasswordField } from 'components';

const password = {
  value: 'p@ssword',
  replacement: 'test1234',
};

it('renders correctly', () => {
  const { asFragment } = render(<PasswordField value={password.value} />);
  expect(asFragment()).toMatchSnapshot();
});

it('handles value change', () => {
  const handleChange = jest.fn();
  render(
    <PasswordField value={password.value} onChange={handleChange} />,
  );
  const passwordInput = screen.getByDisplayValue(password.value);
  expect(passwordInput.value).toBe(password.value);
  fireEvent.change(passwordInput, {
    target: { value: password.replacement },
  });
  expect(handleChange).toHaveBeenCalledTimes(1);
  expect(passwordInput.value).toBe(password.replacement);
});
