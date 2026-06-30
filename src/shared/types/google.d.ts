/// <reference types="gapi" />
/// <reference types="gapi.auth2" />
/// <reference types="gapi.client.sheets" />

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        callback: (response: TokenResponse) => void;
        requestAccessToken: (overrideConfig?: OverridableTokenClientConfig) => void;
      }

      interface TokenResponse {
        access_token: string;
        error?: string;
        error_description?: string;
        error_uri?: string;
        expires_in: number;
        scope: string;
        token_type: string;
      }

      interface OverridableTokenClientConfig {
        prompt?: 'none' | 'consent' | 'select_account';
      }

      interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: string | ((response: TokenResponse) => void);
        error_callback?: (error: unknown) => void;
      }

      function initTokenClient(config: TokenClientConfig): TokenClient;
      function revoke(token: string, callback?: () => void): void;
    }
  }
}
