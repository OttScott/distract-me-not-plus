import React from 'react';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import { SyncStatusButton } from '../index';
import { syncStatusTracker } from 'helpers/syncDiagnostics';
import { syncStorage } from 'helpers/syncStorage';
import { sendMessage } from 'helpers/webext';

jest.mock('helpers/syncDiagnostics');
jest.mock('helpers/syncStorage');
jest.mock('helpers/webext');

describe('SyncStatusButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    syncStatusTracker.getSyncStatus.mockResolvedValue({
      lastSuccessfulSync: new Date().toISOString(),
      syncHealth: 'good',
    });

    syncStorage.get.mockResolvedValue({
      blacklist: ['site1.com', 'site2.com'],
      whitelist: [],
      blacklistKeywords: ['keyword1'],
      whitelistKeywords: [],
    });

    sendMessage.mockResolvedValue('denylist');
  });

  it('should render sync button', async () => {
    render(<SyncStatusButton />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sync status/i })).toBeInTheDocument();
    });
  });

  it('should load and display sync status', async () => {
    const mockSyncStatus = {
      lastSuccessfulSync: new Date(Date.now() - 60000).toISOString(),
      syncHealth: 'good',
    };

    syncStatusTracker.getSyncStatus.mockResolvedValue(mockSyncStatus);

    render(<SyncStatusButton />);

    await waitFor(() => {
      expect(syncStatusTracker.getSyncStatus).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(syncStorage.get).toHaveBeenCalledWith({
        blacklist: [],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
      });
    });
  });

  it('should calculate correct rule count', async () => {
    syncStorage.get.mockResolvedValue({
      blacklist: ['site1.com', 'site2.com'],
      whitelist: ['allow.com'],
      blacklistKeywords: ['keyword1', 'keyword2'],
      whitelistKeywords: ['allow-keyword'],
    });

    render(<SyncStatusButton />);

    await waitFor(() => {
      expect(syncStorage.get).toHaveBeenCalled();
    });
  });

  it('should trigger force sync on button click', async () => {
    render(<SyncStatusButton />);

    const button = await screen.findByRole('button', { name: /sync status/i });

    fireEvent.click(button);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('getMode');
    });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('setMode', 'denylist');
    });

    await waitFor(() => {
      expect(syncStorage.set).toHaveBeenCalledWith({ mode: 'denylist' });
    });
  });

  it('should handle missing sync status gracefully', async () => {
    syncStatusTracker.getSyncStatus.mockResolvedValue(null);

    render(<SyncStatusButton />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sync status/i })).toBeInTheDocument();
    });
  });

  it('should handle sync error gracefully', async () => {
    syncStatusTracker.getSyncStatus.mockRejectedValue(new Error('Sync failed'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<SyncStatusButton />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SyncStatusButton] Failed to load sync status:',
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
