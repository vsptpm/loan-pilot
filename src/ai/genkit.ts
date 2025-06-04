
import { genkit } from 'genkit';
import { googleAI } from 'genkit/plugins/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  // No logLevel option in genkit v1.x
});
