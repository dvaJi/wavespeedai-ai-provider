import { ProviderV3, NoSuchModelError } from "@ai-sdk/provider";
import { FetchFunction, loadApiKey, withUserAgentSuffix } from "@ai-sdk/provider-utils";
import { WaveSpeedAIImageModelId } from "./wavespeedai-image-settings";
import { WaveSpeedAIImageModel } from "./wavespeedai-image-model";
import { VERSION } from "./version";

export interface WaveSpeedAIProviderSettings {
  /**
API token that is being send using the `Authorization` header.
It defaults to the `WAVESPEEDAI_API_TOKEN` environment variable.
   */
  apiToken?: string;

  /**
Use a different URL prefix for API calls, e.g. to use proxy servers.
The default prefix is `https://api.wavespeed.ai/api/v3`.
   */
  baseURL?: string;

  /**
Custom headers to include in the requests.
     */
  headers?: Record<string, string>;

  /**
Custom fetch implementation. You can use it as a middleware to intercept requests,
or to provide a custom fetch implementation for e.g. testing.
    */
  fetch?: FetchFunction;
}

export interface WaveSpeedAIProvider extends ProviderV3 {
  /**
   * Creates a WaveSpeedAI image generation model.
   */
  image(modelId: WaveSpeedAIImageModelId): WaveSpeedAIImageModel;

  /**
   * Creates a WaveSpeedAI image generation model.
   */
  imageModel(modelId: WaveSpeedAIImageModelId): WaveSpeedAIImageModel;
}

/**
 * Create a WaveSpeedAI provider instance.
 */
export function createWaveSpeedAI(options: WaveSpeedAIProviderSettings = {}): WaveSpeedAIProvider {
  const createImageModel = (modelId: WaveSpeedAIImageModelId) =>
    new WaveSpeedAIImageModel(modelId, {
      provider: "wavespeedai",
      baseURL: options.baseURL ?? "https://api.wavespeed.ai/api/v3",
      headers: withUserAgentSuffix(
        {
          Authorization: `Bearer ${loadApiKey({
            apiKey: options.apiToken,
            environmentVariableName: "WAVESPEEDAI_API_TOKEN",
            description: "WaveSpeedAI",
          })}`,
          ...options.headers,
        },
        `ai-sdk/wavespeedai/${VERSION}`,
      ),
      fetch: options.fetch,
    });

  const embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: "embeddingModel",
    });
  };

  return {
    specificationVersion: "v3" as const,
    image: createImageModel,
    imageModel: createImageModel,
    languageModel: (modelId: string) => {
      throw new NoSuchModelError({
        modelId,
        modelType: "languageModel",
      });
    },
    embeddingModel,
    textEmbeddingModel: embeddingModel,
  };
}

/**
 * Default WaveSpeedAI provider instance.
 */
export const wavespeedai = createWaveSpeedAI();
