import Constants from 'expo-constants';
import axios from 'axios';

const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
const apiUrl = process.env.EXPO_PUBLIC_API_URL || extraApiUrl || 'http://127.0.0.1:8000/api';

export const api = axios.create({
  baseURL: apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['x-edi-auth-token'] = token;
    return;
  }

  delete api.defaults.headers.common['x-edi-auth-token'];
}

export function getApiUrl() {
  return apiUrl;
}
