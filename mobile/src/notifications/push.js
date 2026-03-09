import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationsApi } from '../api/services';
import { clearDeviceToken, loadDeviceToken, saveDeviceToken } from '../storage/pushDevice';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f766e',
  });
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return { ok: false, reason: 'simulator' };
  }

  if (Constants.appOwnership === 'expo') {
    return { ok: false, reason: 'expo_go' };
  }

  await ensureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const permissionResponse = await Notifications.requestPermissionsAsync();
    finalStatus = permissionResponse.status;
  }

  if (finalStatus !== 'granted') {
    return { ok: false, reason: 'permission_denied' };
  }

  const projectId = getProjectId();
  const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return {
    ok: true,
    token: tokenResponse.data,
    platform: Device.osName?.toLowerCase() || 'expo',
    deviceName: Device.deviceName || Device.modelName || null,
  };
}

export async function syncPushDeviceRegistration() {
  try {
    const result = await registerForPushNotificationsAsync();
    if (!result.ok) {
      return result;
    }

    await notificationsApi.registerDevice({
      device_token: result.token,
      platform: result.platform === 'ios' || result.platform === 'android' ? result.platform : 'expo',
      device_name: result.deviceName,
    });
    await saveDeviceToken(result.token);
    return result;
  } catch (error) {
    return {
      ok: false,
      reason: 'registration_failed',
      error,
    };
  }
}

export async function unregisterPushDevice() {
  const token = await loadDeviceToken();
  if (!token) {
    return { ok: true, reason: 'missing_token' };
  }

  try {
    await notificationsApi.deleteDevice(token);
    await clearDeviceToken();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: 'delete_failed',
      error,
    };
  }
}
