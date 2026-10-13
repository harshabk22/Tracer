import { useState, useEffect } from 'react';
import { indexedDbStore, STORES } from '../services/indexedDbStore';

export interface DeviceStatus {
  isOnline: boolean;
  effectiveConnectionType: string;
  isSaveData: boolean;
  batteryLevel: number | null; // 0.0 to 1.0, e.g. 0.85 for 85%
  isCharging: boolean | null;
  isLowBattery: boolean; // <20% and not charging
  isPowerSaverMode: boolean; // Low battery or user requested save data
  telemetryPillText: string; // Formatted executive micro-metric string
  vaultStats: {
    isAvailable: boolean;
    totalGoals: number;
    pendingSyncCount: number;
  };
}

export function useDeviceStatus(): DeviceStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [effectiveConnectionType, setEffectiveConnectionType] = useState<string>(() => {
    if (typeof navigator === 'undefined') return 'Wi-Fi';
    const conn = (navigator as any).connection;
    if (conn?.type === 'wifi') return 'Wi-Fi';
    if (conn?.effectiveType) {
      if (conn.effectiveType === '4g') return '5G';
      return conn.effectiveType.toUpperCase();
    }
    return 'Online';
  });

  const [isSaveData, setIsSaveData] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return Boolean((navigator as any).connection?.saveData);
  });

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);

  const [vaultStats, setVaultStats] = useState<{
    isAvailable: boolean;
    totalGoals: number;
    pendingSyncCount: number;
  }>({
    isAvailable: indexedDbStore.isAvailable(),
    totalGoals: 0,
    pendingSyncCount: 0,
  });

  // Network status listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      const conn = (navigator as any).connection;
      if (conn?.effectiveType) {
        setEffectiveConnectionType(conn.effectiveType === '4g' ? '5G' : conn.effectiveType.toUpperCase());
      } else {
        setEffectiveConnectionType('Online');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setEffectiveConnectionType('Offline');
    };

    const conn = (navigator as any).connection;
    const handleConnectionChange = () => {
      if (conn) {
        if (conn.type === 'wifi') {
          setEffectiveConnectionType('Wi-Fi');
        } else if (conn.effectiveType) {
          setEffectiveConnectionType(conn.effectiveType === '4g' ? '5G' : conn.effectiveType.toUpperCase());
        }
        setIsSaveData(Boolean(conn.saveData));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  // Battery status listener (Android Chromium & modern WebView)
  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    let batteryManager: any = null;

    const updateBattery = (battery: any) => {
      setBatteryLevel(battery.level);
      setIsCharging(battery.charging);
    };

    const handleLevelChange = () => {
      if (batteryManager) setBatteryLevel(batteryManager.level);
    };

    const handleChargingChange = () => {
      if (batteryManager) setIsCharging(batteryManager.charging);
    };

    if (typeof (navigator as any).getBattery === 'function') {
      (navigator as any).getBattery().then((battery: any) => {
        batteryManager = battery;
        updateBattery(battery);
        battery.addEventListener('levelchange', handleLevelChange);
        battery.addEventListener('chargingchange', handleChargingChange);
      }).catch((e: any) => {
        // Battery API may be rejected if unsupported or policy-blocked
        console.debug('[useDeviceStatus] Battery API unavailable:', e);
      });
    }

    return () => {
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', handleLevelChange);
        batteryManager.removeEventListener('chargingchange', handleChargingChange);
      }
    };
  }, []);

  // Refresh vault metrics
  useEffect(() => {
    let isMounted = true;

    async function loadVaultTelemetry() {
      if (!indexedDbStore.isAvailable()) return;
      try {
        const goals = await indexedDbStore.getAll(STORES.GOALS);
        if (isMounted) {
          setVaultStats({
            isAvailable: true,
            totalGoals: goals.length,
            pendingSyncCount: 0,
          });
        }
      } catch (err) {
        console.debug('[useDeviceStatus] Vault telemetry query failed:', err);
      }
    }

    loadVaultTelemetry();
    const interval = setInterval(loadVaultTelemetry, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const isLowBattery = batteryLevel !== null && batteryLevel <= 0.20 && isCharging === false;
  const isPowerSaverMode = isLowBattery || isSaveData;

  const telemetryPillText = formatDeviceTelemetryPill({
    isOnline,
    batteryLevel,
    isCharging,
    isLowBattery,
    effectiveConnectionType,
  });

  return {
    isOnline,
    effectiveConnectionType,
    isSaveData,
    batteryLevel,
    isCharging,
    isLowBattery,
    isPowerSaverMode,
    telemetryPillText,
    vaultStats,
  };
}

export interface DeviceTelemetryFormatParams {
  isOnline: boolean;
  batteryLevel: number | null;
  isCharging: boolean | null;
  isLowBattery: boolean;
  effectiveConnectionType: string;
}

export function formatDeviceTelemetryPill({
  isOnline,
  batteryLevel,
  isCharging,
  isLowBattery,
  effectiveConnectionType,
}: DeviceTelemetryFormatParams): string {
  if (!isOnline) {
    return 'OFFLINE FLIGHT READY';
  }
  if (isLowBattery && batteryLevel !== null) {
    return `⚡ ${Math.round(batteryLevel * 100)}% Eco Mode`;
  }
  if (batteryLevel !== null) {
    const chargeSymbol = isCharging ? '⚡' : '';
    return `${chargeSymbol}${Math.round(batteryLevel * 100)}% • ${effectiveConnectionType}`;
  }
  return effectiveConnectionType;
}
