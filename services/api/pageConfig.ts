import { createRequestClient, type TokenStorage } from '@project_neko/request';

export interface PageConfigResponse {
  success: boolean;
  lanlan_name: string;
  model_path: string;
  model_type: string;
  live3d_sub_type?: string;
  error?: string;
}

class NoopTokenStorage implements TokenStorage {
  async getAccessToken(): Promise<string | null> { return null; }
  async setAccessToken(_token: string): Promise<void> {}
  async getRefreshToken(): Promise<string | null> { return null; }
  async setRefreshToken(_token: string): Promise<void> {}
  async clearTokens(): Promise<void> {}
}

const noopStorage = new NoopTokenStorage();
const failedRefresh = async () => { throw new Error('No refresh token'); };

export function createPageConfigApiClient(apiBase: string, p2pToken?: string) {
  const client = createRequestClient({
    baseURL: `${apiBase}/api`,
    storage: noopStorage,
    refreshApi: failedRefresh,
    returnDataOnly: true,
  });

  if (p2pToken) {
    client.interceptors.request.use((config) => {
      config.params = { ...config.params, token: p2pToken };
      return config;
    });
  }

  return {
    async getPageConfig(lanlanName?: string): Promise<PageConfigResponse> {
      const params = lanlanName ? { lanlan_name: lanlanName } : undefined;
      return client.get('/config/page_config', { params });
    },
  };
}
