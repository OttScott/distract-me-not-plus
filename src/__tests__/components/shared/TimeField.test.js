import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { TimeField } from 'components';

it('renders correctly', () => {
  const { asFragment } = render(<TimeField label="time" />);
  expect(asFragment()).toMatchSnapshot();
});

it('handles value change', () => {
  const handleChange = jest.fn();
  render(<TimeField label="time" value="12:00" onChange={handleChange} />);
  const input = screen.getByDisplayValue('12:00');
  fireEvent.change(input, { target: { value: '13:00' } });
  expect(handleChange).toHaveBeenCalledTimes(1);
});
