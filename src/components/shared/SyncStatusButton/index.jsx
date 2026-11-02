import React, { Component } from 'react';
import { IconButton, CloudUploadIcon, Tooltip, Position } from 'evergreen-ui';
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
    console.log('[SyncStatusButton] componentDidMount');
    this.loadSyncStatus();
  }

  componentWillUnmount() {
    console.error('[SyncStatusButton] componentWillUnmount - Button is being removed!');
  }

  componentDidCatch(error, errorInfo) {
    console.error('[SyncStatusButton] Component crashed:', error, errorInfo);
  }

  loadSyncStatus = async () => {
    console.log('[SyncStatusButton] loadSyncStatus started');
    try {
      const syncStatus = await syncStatusTracker.getSyncStatus();
      console.log('[SyncStatusButton] Got sync status:', syncStatus);

      // Get rule counts
      const settings = await syncStorage.get({
        blacklist: [],
        whitelist: [],
        blacklistKeywords: [],
        whitelistKeywords: [],
      });
      console.log('[SyncStatusButton] Got settings, calculating rule count');

      const ruleCount =
        (settings.blacklist?.length || 0) +
        (settings.whitelist?.length || 0) +
        (settings.blacklistKeywords?.length || 0) +
        (settings.whitelistKeywords?.length || 0);

      console.log('[SyncStatusButton] Setting state with', ruleCount, 'rules');
      this.setState({ syncStatus, ruleCount });
    } catch (error) {
      console.error('[SyncStatusButton] Failed to load sync status:', error);
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
    if (!syncStatus) return '#66788A'; // Neutral grey

    switch (syncStatus.syncHealth) {
      case 'good':
        return '#47B881'; // Bright green
      case 'fair':
        return '#F7D154'; // Bright yellow
      case 'poor':
        return '#EC4C47'; // Bright red
      default:
        return '#66788A'; // Neutral grey
    }
  };

  render() {
    console.log('[SyncStatusButton] render() called, state:', this.state);
    const { syncStatus, ruleCount, loading } = this.state;
    const iconColor = this.getSyncHealthColor();

    const tooltipContent = (
      <div style={{ color: '#fff' }}>
        <div style={{ marginBottom: '4px' }}>
          <strong>Last Sync:</strong> {this.formatLastSync()}
        </div>
        <div style={{ marginBottom: '4px' }}>
          <strong>Rules:</strong> {ruleCount}
        </div>
        {syncStatus?.syncHealth && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong>Health:</strong>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '3px',
                backgroundColor: iconColor,
                color: '#fff',
                fontWeight: '600',
                fontSize: '11px',
                textTransform: 'uppercase',
              }}
            >
              {syncStatus.syncHealth}
            </span>
          </div>
        )}
      </div>
    );

    const StyledCloudIcon = () => <CloudUploadIcon color={iconColor} />;

    return (
      <Tooltip content={tooltipContent} position={Position.BOTTOM}>
        <IconButton
          icon={StyledCloudIcon}
          appearance="minimal"
          isLoading={loading}
          onClick={this.forceSync}
          aria-label="Sync status"
        />
      </Tooltip>
    );
  }
}
