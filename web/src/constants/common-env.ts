const webConfig = {
    apiUrl: import.meta.env.DEV ? 'http://127.0.0.1:7000' : '',
    appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
};

export default webConfig;
