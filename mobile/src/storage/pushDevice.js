import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_TOKEN_KEY = 'edi.mobile.pushDeviceToken';

export async function saveDeviceToken(token) {
  await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export async function loadDeviceToken() {
  return AsyncStorage.getItem(DEVICE_TOKEN_KEY);
}

export async function clearDeviceToken() {
  await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
}
