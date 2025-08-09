import React from 'react';
import { Pane, Heading, Text } from 'evergreen-ui';
import { translate } from 'helpers/i18n';
import './styles.scss';

// Get version from manifest at runtime
const getVersion = () => {
  try {
    return chrome?.runtime?.getManifest?.()?.version || '3.14.1';
  } catch {
    return '3.14.1';
  }
};

export function Header(props) {
  const version = getVersion();
  return (
    <Pane
      display="flex"
      alignItems="center"
      justifyContent={props.justifyContent || 'center'}
      height={props.height || 62}
      borderBottom={!props.noBorderBottom}
      marginBottom={props.marginBottom}
    >
      <img className="logo" alt="logo" src="icons/magnet-256.png" />
      <Heading
        size={600}
        fontFamily="Roboto, arial, sans-serif"
        fontWeight="bold"
        className="cursor-default"
        color="#333"
      >
        {translate('appName') || 'Distract Me Not Plus'}
      </Heading>
      <Text size={300} color="muted" marginLeft={8} className="cursor-default">
        v{version}
      </Text>
    </Pane>
  );
}
