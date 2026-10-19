import React from 'react';
import ReactDOM from 'react-dom';
import { SyncStatusButton } from './src/components/shared/SyncStatusButton';

// Minimal test to see if component renders
const root = document.getElementById('root');
ReactDOM.render(<SyncStatusButton />, root);
console.log('SyncStatusButton rendered in isolation');
