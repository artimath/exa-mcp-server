import { z } from "zod";
import axios from "axios";
import { toolRegistry, API_CONFIG } from "./config.js";
import { createRequestLogger } from "../utils/logger.js";
// TODO: Define these types properly in src/types.ts
import {
  ExaWebsetCreateRequest,
  ExaWebsetCreateResponse,
  ExaWebsetStatusResponse, // Assuming this type will be added
  ExaWebsetItemsResponse   // Assuming this type will be added
} from "../types.js";

// Define the schema for enrichment parameters
const enrichmentSchema = z.object({
  description: z.string().describe("Description of the data to extract (e.g., 'LinkedIn profile of VP of Engineering')"),
  format: z.string().describe("Desired format of the enrichment result (e.g., 'text', 'json')")
}).describe("Optional enrichment task applied to each found item");

// Register the WebSet research tool
toolRegistry["run_webset_research"] = {
  name: "run_webset_research",
  description: "Initiates an asynchronous Exa WebSet research task based on a query and criteria. Can optionally wait for completion and retrieve results.",
  schema: {
    query: z.string().describe("The primary search query for the WebSet."),
    count: z.number().optional().describe("Approximate number of results to aim for."),
    // TODO: Refine criteria, entityType, metadata based on API docs if needed
    criteria: z.string().optional().describe("Specific verification criteria for results."),
    entityType: z.string().optional().describe("Expected type of entity being searched (e.g., 'company', 'person')."),
    enrichments: z.array(enrichmentSchema).optional().describe("List of enrichment tasks to apply to results."),
    metadata: z.record(z.string(), z.any()).optional().describe("Optional metadata to associate with the WebSet."),
    waitForCompletion: z.boolean().optional().default(true).describe("If true, waits for the WebSet to complete and returns results. If false, returns the WebSet ID immediately.")
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handler: async (args, _extra) => { // Prefix unused 'extra' parameter and add ignore comment
    const { query, count, criteria, entityType, enrichments, metadata, waitForCompletion } = args;
    const requestId = `webset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logger = createRequestLogger(requestId, 'run_webset_research');

    logger.start(`Query: ${query}, Wait: ${waitForCompletion}`);

    const apiKey = process.env.EXA_API_KEY || '';
    if (!apiKey) {
      logger.error("EXA_API_KEY is not set.");
      return {
        content: [{ type: "text", text: "Configuration error: EXA_API_KEY is missing." }],
        isError: true,
      };
    }

    try {
      const axiosInstance = axios.create({
        baseURL: API_CONFIG.BASE_URL, // Assuming same base URL
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-api-key': apiKey
        },
        timeout: 30000 // Increased timeout for potentially longer operations
      });

      // Construct the request payload for creating a WebSet
      // Based on research summary structure
      const websetParams: ExaWebsetCreateRequest = { // Use the specific type
        search: {
          query: query,
          ...(count && { count: count }), // Include count only if provided
        },
        ...(criteria && { criteria: criteria }),
        ...(entityType && { entity: { type: entityType } }),
        ...(enrichments && enrichments.length > 0 && { enrichments: enrichments }),
        ...(metadata && { metadata: metadata }),
      };

      logger.log("Sending request to create WebSet...");

      // Use the correct versioned endpoint for creation
      const createResponse = await axiosInstance.post<ExaWebsetCreateResponse>(
        '/websets/v0/websets/', // Corrected endpoint
        websetParams
      );

      const websetId = createResponse.data.id; // Assuming response contains an 'id'
      logger.log(`WebSet created with ID: ${websetId}`);

      if (!waitForCompletion) {
        logger.complete(); // Removed argument
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "WebSet research initiated successfully.",
              websetId: websetId,
              status: "running" // Initial status
            }, null, 2)
          }]
        };
      } else {
        // --- Polling Logic ---
        logger.log(`Waiting for WebSet ${websetId} completion...`);
        const maxAttempts = 12; // Max 1 minute wait (12 * 5 seconds)
        const pollInterval = 5000; // 5 seconds

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            // Use the correct endpoint to get WebSet details (which includes status)
            const detailsResponse = await axiosInstance.get<ExaWebsetStatusResponse>(`/websets/v0/websets/${websetId}`); // Corrected endpoint
            const status = detailsResponse.data.status; // Assuming response has a 'status' field

            logger.log(`Attempt ${attempt}: WebSet status is '${status}'`);

            if (status === 'completed' || status === 'idle') {
              logger.log(`WebSet ${websetId} completed. Fetching items...`);
              // Use the correct endpoint to list items
              const itemsResponse = await axiosInstance.get<ExaWebsetItemsResponse>(`/websets/v0/websets/${websetId}/items`); // Corrected endpoint

              logger.complete();
              return {
                content: [{
                  type: "text",
                  text: JSON.stringify(itemsResponse.data, null, 2) // Return the items
                }]
              };
            } else if (status === 'failed' || status === 'error') {
              logger.error(`WebSet ${websetId} failed with status: ${status}`);
              throw new Error(`WebSet research failed with status: ${status}`);
            }

            // If not completed/idle/failed, wait for the next poll
            await sleep(pollInterval);

          } catch (pollError) {
            // Log polling error but continue loop unless it's the last attempt
            logger.error(`Polling attempt ${attempt} failed: ${pollError instanceof Error ? pollError.message : String(pollError)}`);
            if (attempt === maxAttempts) {
              throw new Error(`Failed to get WebSet status after ${maxAttempts} attempts.`);
            }
            await sleep(pollInterval); // Wait before retrying after an error
          }
        }

        // If loop finishes without completion
        logger.error(`WebSet ${websetId} did not complete within the timeout period.`);
        throw new Error("WebSet research timed out.");
        // --- End Polling Logic ---
      }

    } catch (error) {
      logger.error(error);
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 'unknown';
        const errorMessage = error.response?.data?.message || error.message;
        logger.log(`Axios error (${statusCode}): ${errorMessage}`);
        return {
          content: [{ type: "text", text: `WebSet API error (${statusCode}): ${errorMessage}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: `WebSet operation failed: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  },
  enabled: true // Enable this new tool by default
};

// Helper function for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
