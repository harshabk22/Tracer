import { describe, it, expect } from 'vitest';
import {
  formatDeviceTelemetryPill,
  DeviceTelemetryFormatParams,
} from '../../hooks/useDeviceStatus';

describe('Device Telemetry Formatting & Executive Hardware Logic', () => {
  it('displays OFFLINE FLIGHT READY when disconnected from network regardless of battery', () => {
    const params: DeviceTelemetryFormatParams = {
      isOnline: false,
      batteryLevel: 0.95,
      isCharging: false,
      isLowBattery: false,
      effectiveConnectionType: 'Offline',
    };

    expect(formatDeviceTelemetryPill(params)).toBe('OFFLINE FLIGHT READY');
  });

  it('displays low power Eco Mode with lightning prefix when battery is <= 20% and discharging', () => {
    const params: DeviceTelemetryFormatParams = {
      isOnline: true,
      batteryLevel: 0.14,
      isCharging: false,
      isLowBattery: true,
      effectiveConnectionType: '5G',
    };

    expect(formatDeviceTelemetryPill(params)).toBe('⚡ 14% Eco Mode');
  });

  it('displays charging indicator ⚡ when battery is plugged in', () => {
    const params: DeviceTelemetryFormatParams = {
      isOnline: true,
      batteryLevel: 0.85,
      isCharging: true,
      isLowBattery: false,
      effectiveConnectionType: 'Wi-Fi',
    };

    expect(formatDeviceTelemetryPill(params)).toBe('⚡85% • Wi-Fi');
  });

  it('displays standard percentage and network speed when discharging with healthy battery', () => {
    const params: DeviceTelemetryFormatParams = {
      isOnline: true,
      batteryLevel: 0.72,
      isCharging: false,
      isLowBattery: false,
      effectiveConnectionType: '5G',
    };

    expect(formatDeviceTelemetryPill(params)).toBe('72% • 5G');
  });

  it('falls back to connection type when battery API is not exposed on desktop browser', () => {
    const params: DeviceTelemetryFormatParams = {
      isOnline: true,
      batteryLevel: null,
      isCharging: null,
      isLowBattery: false,
      effectiveConnectionType: '5G',
    };

    expect(formatDeviceTelemetryPill(params)).toBe('5G');
  });
});
