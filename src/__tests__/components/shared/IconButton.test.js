import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { CrossIcon } from 'evergreen-ui';
import { IconButton } from 'components';

it('renders correctly', () => {
  const { asFragment } = render(<IconButton icon={CrossIcon} />);
  expect(asFragment()).toMatchSnapshot();
});

it('handles click', () => {
  const handleClick = jest.fn();
  const { getByRole } = render(<IconButton icon={CrossIcon} onClick={handleClick} />);
  fireEvent.click(getByRole('button'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
