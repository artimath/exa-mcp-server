// Exa API Types
export interface ExaSearchRequest {
  query: string;
  type: string;
  category?: string;
  includeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  numResults: number;
  contents: {
    text: {
      maxCharacters?: number;
    } | boolean;
    livecrawl?: 'always' | 'fallback';
  };
}

export interface ExaSearchResult {
  id: string;
  title: string;
  url: string;
  publishedDate: string;
  author: string;
  text: string;
  image?: string;
  favicon?: string;
  score?: number;
}

export interface ExaSearchResponse {
  requestId: string;
  autopromptString: string;
  resolvedSearchType: string;
  results: ExaSearchResult[];
}

// Tool Types
export interface SearchArgs {
  query: string;
  numResults?: number;
  livecrawl?: 'always' | 'fallback';
}

// WebSet Types (Basic placeholders - refine based on actual API response)
export interface ExaWebsetEnrichmentParams {
  description: string;
  format: string;
}

export interface ExaWebsetSearchConfig {
  query: string;
  count?: number;
}

export interface ExaWebsetEntityConfig {
  type: string;
}

export interface ExaWebsetCreateRequest {
  search: ExaWebsetSearchConfig;
  criteria?: string;
  entity?: ExaWebsetEntityConfig;
  enrichments?: ExaWebsetEnrichmentParams[];
  metadata?: Record<string, unknown>; // Use unknown instead of any
}

export interface ExaWebsetCreateResponse {
  id: string; // Assuming the response contains the WebSet ID
  // Add other potential fields from the actual API response if known
}

// TODO: Add types for WebSet status and item retrieval responses
export interface ExaWebsetStatusResponse {
  status: 'running' | 'completed' | 'idle' | 'failed' | 'error'; // Assuming possible statuses
  // Add other potential fields
}

export interface ExaWebsetItem {
  // Define structure based on expected item data from Exa
  id: string;
  url: string;
  title?: string;
  content?: string; // Or more structured fields
  verificationStatus?: string;
  verificationReasoning?: string;
  enrichmentResults?: Record<string, unknown>; // Use unknown instead of any
  // ... other fields
}

export interface ExaWebsetItemsResponse {
  items: ExaWebsetItem[];
  // Add other potential fields like pagination info
}
