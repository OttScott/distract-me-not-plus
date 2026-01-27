import React, { Component } from 'react';
import { IconButton, CloudUploadIcon, Tooltip, Position, Badge } from 'evergreen-ui';
import { sendMessage } from 'helpers/webext';
import { syncStatusTracker } from 'helpers/syncDiagnostics';
import { syncStorage } from 'helpers/syncStorage';

export class SyncStatusButton extends Component {
  constructor(props) {
    super(props);
    this.state = {
      syncStatus: null,
      ruleCount: 0,
      loading: false,
    };
  }

  componentDidMount() {
    this.loadSyncStatus();
  }

  loadSyncStatus = async () => {
    try {
      const syncStatus = await syncStatusTracker.getSyncStatus();

      // Get rule counts
      const settings = await syncStorage.get({
        blacklist: [],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
      });

      const ruleCount =
        (settings.blacklist?.length || 0) +
        (settings.whitelist?.length || 0) +
        (settings.blacklistKeywords?.length || 0) +
        (settings.whitelistKeywords?.length || 0);

      this.setState({ syncStatus, ruleCount });
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  forceSync = async () => {
    this.setState({ loading: true });

    try {
      // Trigger a sync by getting and setting the mode (which is synced)
      const mode = await sendMessage('getMode');
      await sendMessage('setMode', mode);
      await syncStorage.set({ mode });

      // Reload sync status
      await this.loadSyncStatus();

      // Show success feedback
      setTimeout(() => {
        this.setState({ loading: false });
      }, 500);
    } catch (error) {
      console.error('Failed to force sync:', error);
      this.setState({ loading: false });
    }
  };

  formatLastSync = () => {
    const { syncStatus } = this.state;
    if (!syncStatus?.lastSuccessfulSync) {
      return 'Never';
    }

    const syncTime = new Date(syncStatus.lastSuccessfulSync);
    const now = new Date();
    const diffMs = now - syncTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return syncTime.toLocaleDateString();
  };

  getSyncHealthColor = () => {
    const { syncStatus } = this.state;
    if (!syncStatus) return 'neutral';

    switch (syncStatus.syncHealth) {
      case 'good':
        return 'green';
      case 'fair':
        return 'yellow';
      case 'poor':
        return 'red';
      default:
        return 'neutral';
    }
  };

  render() {
    const { syncStatus, ruleCount, loading } = this.state;
    const tooltipContent = (
      <div>
        <div>
          <strong>Last Sync:</strong> {this.formatLastSync()}
        </div>
        <div>
          <strong>Rules:</strong> {ruleCount}
        </div>
        {syncStatus?.syncHealth && (
          <div>
            <strong>Health:</strong> {syncStatus.syncHealth}
          </div>
        )}
      </div>
    );

    return (
      <Tooltip content={tooltipContent} position={Position.BOTTOM}>
        <IconButton
          icon={CloudUploadIcon}
          appearance="minimal"
          isLoading={loading}
          onClick={this.forceSync}
          aria-label="Sync status"
          position="relative"
        >
          {syncStatus && (
            <Badge
              color={this.getSyncHealthColor()}
              position="absolute"
              top={-2}
              right={-2}
              style={{ minWidth: '6px', minHeight: '6px', padding: '2px' }}
            />
          )}
        </IconButton>
      </Tooltip>
    );
  }
}
