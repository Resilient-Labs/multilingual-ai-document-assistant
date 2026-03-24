declare module "word-extractor" {
  export interface WordDocument {
    getBody(): string;
  }

  export default class WordExtractor {
    constructor();
    extract(input: Buffer | string): Promise<WordDocument>;
  }
}
