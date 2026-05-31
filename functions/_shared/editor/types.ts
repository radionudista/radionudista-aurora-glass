export interface EditorRuntimeConfig {
  archive?: {
    accessKey?: string;
    secretKey?: string;
    collection?: string;
  };
  translation?: {
    apiKey?: string;
    endpointUrl?: string;
    monthlyCharLimit?: number;
  };
}
