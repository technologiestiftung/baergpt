declare module "mistral-tokenizer-ts" {
	export interface MistralTokenizer {
		encode(text: string, bos: boolean, eos: boolean): number[];
	}

	export function getTokenizerForModel(model: string): MistralTokenizer;
}
