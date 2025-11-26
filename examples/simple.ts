import fs from "fs";
import { createWaveSpeedAI } from "../src/index";
import { experimental_generateImage as generateImage } from "ai";

const wavespeedai = createWaveSpeedAI({
  apiToken: "d99d9cd70cad1ee21ab267b4365347a288a991f1c61f3f1510beea0deb7e1933",
});

const { image } = await generateImage({
  model: wavespeedai.image("google/nano-banana-pro/text-to-image"),
  prompt: "A detailed cat working as a café barista",
});

// Save the generated image
const filename = `image-${Date.now()}.png`;
fs.writeFileSync(filename, image.uint8Array);
console.log(`Image saved to ${filename}`);
