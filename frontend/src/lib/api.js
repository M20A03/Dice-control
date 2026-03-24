const getDefaultApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return import.meta.env.DEV ? 'http://localhost:4000' : '';
};

export const API_URL = getDefaultApiUrl();

export const fetchApi = async (path, options = {}) => {
  const headers = {
    ...options.headers,
    'Bypass-Tunnel-Reminder': 'true',
  };

  try {
    return await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error('Unable to reach API server. Check backend URL and network.');
  }
};

export const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};
