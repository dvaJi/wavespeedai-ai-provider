import type { ImageModelV2, ImageModelV2CallWarning } from "@ai-sdk/provider";
import type { Resolvable } from "@ai-sdk/provider-utils";
import {
  FetchFunction,
  combineHeaders,
  createBinaryResponseHandler,
  createJsonResponseHandler,
  getFromApi,
  postJsonToApi,
  resolve,
} from "@ai-sdk/provider-utils";
import { z } from "zod/v4";
import { wavespeedaiFailedResponseHandler } from "./wavespeedai-error";
import { WaveSpeedAIImageModelId } from "./wavespeedai-image-settings";

interface WaveSpeedAIImageModelConfig {
  provider: string;
  baseURL: string;
  headers?: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}

export class WaveSpeedAIImageModel implements ImageModelV2 {
  readonly specificationVersion = "v2";
  readonly maxImagesPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: WaveSpeedAIImageModelId,
    private readonly config: WaveSpeedAIImageModelConfig,
  ) {}

  async doGenerate({
    prompt,
    n,
    aspectRatio,
    size,
    seed,
    providerOptions,
    headers,
    abortSignal,
  }: Parameters<ImageModelV2["doGenerate"]>[0]): Promise<Awaited<ReturnType<ImageModelV2["doGenerate"]>>> {
    const warnings: Array<ImageModelV2CallWarning> = [];

    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    const { value: valueCreateImage, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/${this.modelId}`,
      headers: combineHeaders(await resolve(this.config.headers), headers, {
        prefer: "wait",
      }),

      body: {
        prompt,
        aspect_ratio: aspectRatio,
        size,
        seed,
        num_outputs: n,
        ...(providerOptions.wavespeedai ?? {}),
      },

      successfulResponseHandler: createJsonResponseHandler(wavespeedaiPredictResponseSchema),
      failedResponseHandler: wavespeedaiFailedResponseHandler,
      abortSignal,
      fetch: this.config.fetch,
    });

    let output: null | string | string[] = null;

    while (true) {
      const { value } = await postJsonToApi({
        url: `${this.config.baseURL}/predictions/${valueCreateImage.data.id}/result`,
        headers: combineHeaders(await resolve(this.config.headers), headers, {
          prefer: "wait",
        }),

        body: {
          prompt,
          aspect_ratio: aspectRatio,
          size,
          seed,
          num_outputs: n,
          ...(providerOptions.wavespeedai ?? {}),
        },

        successfulResponseHandler: createJsonResponseHandler(wavespeedaiImageResponseSchema),
        failedResponseHandler: wavespeedaiFailedResponseHandler,
        abortSignal,
        fetch: this.config.fetch,
      });

      const data = value.data;
      const status = data.status;

      if (status === "completed") {
        output = data.outputs;
        break;
      } else if (status === "failed") {
        console.error("Task failed:", data.error);
        break;
      } else {
        console.log("Task still processing. Status:", status);
      }

      await new Promise((resolve) => setTimeout(resolve, 0.1 * 1000));
    }

    if (output === null) {
      throw new Error("Image generation failed or was not completed.");
    }

    // download the images:
    const outputArray = Array.isArray(output) ? output : [output];
    const images = await Promise.all(
      outputArray.map(async (url) => {
        const { value: image } = await getFromApi({
          url,
          successfulResponseHandler: createBinaryResponseHandler(),
          failedResponseHandler: wavespeedaiFailedResponseHandler,
          abortSignal,
          fetch: this.config.fetch,
        });
        return image;
      }),
    );

    return {
      images,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }
}

const wavespeedaiPredictResponseSchema = z.object({
  data: z.object({
    id: z.string(),
  }),
});

const wavespeedaiImageResponseSchema = z.object({
  data: z.object({
    outputs: z.union([z.array(z.string()), z.string()]),
    status: z.enum(["completed", "failed", "processing"]),
    error: z.string().optional(),
  }),
});
