/**
 * Text Embedder
 *
 * Generates vector embeddings using the nomic-embed-text model via Transformers.js.
 * Uses ONNX runtime under the hood for fast local inference.
 */

import * as path from 'path';
import * as fs from 'fs';
import { homedir } from 'os';

// Global model cache directory - uses codegraph's models directory for shared embedding models
const GLOBAL_MODELS_DIR = path.join(homedir(), '.codegraph', 'models');

// Dynamic import for @xenova/transformers (ESM-only package)
// We use dynamic import to support CommonJS builds
let transformersModule: typeof import('@xenova/transformers') | null = null;

async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@xenova/transformers');
  }
  return transformersModule;
}

// Type for the feature extraction pipeline
type FeatureExtractionPipeline = any;

/**
 * Default model for embeddings
 * nomic-embed-text-v1.5 produces 384-dimensional embeddings
 */
export const DEFAULT_MODEL = 'nomic-ai/nomic-embed-text-v1.5';
export const EMBEDDING_DIMENSION = 768; // nomic-embed-text-v1.5 uses 768 dimensions

/**
 * Options for the embedder
 */
export interface EmbedderOptions {
  /** Model ID to use (default: nomic-ai/nomic-embed-text-v1.5) */
  modelId?: string;

  /** Directory to cache the model (default: ~/.codegraph/models) */
  cacheDir?: string;

  /** Whether to show progress during model download */
  showProgress?: boolean;
}

/**
 * Text embedding result
 */
export interface EmbeddingResult {
  /** The embedding vector */
  embedding: Float32Array;

  /** Dimension of the embedding */
  dimension: number;

  /** Model used to generate the embedding */
  model: string;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  /** Array of embeddings in same order as input */
  embeddings: Float32Array[];

  /** Dimension of each embedding */
  dimension: number;

  /** Model used to generate embeddings */
  model: string;

  /** Processing time in milliseconds */
  durationMs: number;
}

/**
 * Text Embedder using Transformers.js
 *
 * Uses the nomic-embed-text-v1.5 model to generate embeddings for code
 * and natural language queries.
 */
export class TextEmbedder {
  private modelId: string;
  private cacheDir: string;
  private pipeline: FeatureExtractionPipeline | null = null;
  private initialized = false;
  private showProgress: boolean;

  constructor(options: EmbedderOptions = {}) {
    this.modelId = options.modelId || DEFAULT_MODEL;
    this.cacheDir = options.cacheDir || GLOBAL_MODELS_DIR;
    this.showProgress = options.showProgress ?? false;
  }

  /**
   * Initialize the embedder by loading the model
   *
   * This will download the model on first use if not already cached.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load transformers.js dynamically (ESM-only package)
    const { pipeline, env } = await getTransformers();

    // Configure transformers.js to use local cache
    env.cacheDir = this.cacheDir;

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Disable remote model checking if model is already cached
    // This speeds up initialization significantly
    const modelCacheExists = fs.existsSync(
      path.join(this.cacheDir, this.modelId.replace('/', '--'))
    );
    if (modelCacheExists) {
      env.allowRemoteModels = false;
    }

    // Load the pipeline
    this.pipeline = await pipeline('feature-extraction', this.modelId, {
      progress_callback: this.showProgress
        ? (progress: { status: string; file?: string; progress?: number }) => {
            if (progress.status === 'progress' && progress.file && progress.progress) {
              const pct = Math.round(progress.progress);
              process.stdout.write(`\rDownloading ${progress.file}: ${pct}%`);
            } else if (progress.status === 'done') {
              process.stdout.write('\n');
            }
          }
        : undefined,
    });

    this.initialized = true;
  }

  /**
   * Check if the embedder is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the model ID being used
   */
  getModelId(): string {
    return this.modelId;
  }

  /**
   * Get the embedding dimension
   */
  getDimension(): number {
    return EMBEDDING_DIMENSION;
  }

  /**
   * Generate embedding for a single text
   *
   * @param text - Text to embed
   * @returns Embedding result
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.initialized || !this.pipeline) {
      throw new Error('Embedder not initialized. Call initialize() first.');
    }

    // Prepare text for nomic-embed-text (it expects specific prefixes)
    const preparedText = this.prepareText(text, 'document');

    // Generate embedding
    const output = await this.pipeline(preparedText, {
      pooling: 'mean',
      normalize: true,
    });

    // Extract the embedding array - handle various data formats
    const data = output.data as unknown;
    const embedding = this.toFloat32Array(data);

    return {
      embedding,
      dimension: embedding.length,
      model: this.modelId,
    };
  }

  /**
   * Generate embedding for a query (uses different prefix)
   *
   * @param query - Query text to embed
   * @returns Embedding result
   */
  async embedQuery(query: string): Promise<EmbeddingResult> {
    if (!this.initialized || !this.pipeline) {
      throw new Error('Embedder not initialized. Call initialize() first.');
    }

    // Prepare text for nomic-embed-text query
    const preparedText = this.prepareText(query, 'search_query');

    // Generate embedding
    const output = await this.pipeline(preparedText, {
      pooling: 'mean',
      normalize: true,
    });

    // Extract the embedding array - handle various data formats
    const data = output.data as unknown;
    const embedding = this.toFloat32Array(data);

    return {
      embedding,
      dimension: embedding.length,
      model: this.modelId,
    };
  }

  /**
   * Generate embeddings for multiple texts in a batch
   *
   * @param texts - Array of texts to embed
   * @param type - Type of text (document or search_query)
   * @returns Batch embedding result
   */
  async embedBatch(
    texts: string[],
    type: 'document' | 'search_query' = 'document'
  ): Promise<BatchEmbeddingResult> {
    if (!this.initialized || !this.pipeline) {
      throw new Error('Embedder not initialized. Call initialize() first.');
    }

    if (texts.length === 0) {
      return {
        embeddings: [],
        dimension: EMBEDDING_DIMENSION,
        model: this.modelId,
        durationMs: 0,
      };
    }

    const startTime = Date.now();

    // Prepare all texts
    const preparedTexts = texts.map((t) => this.prepareText(t, type));

    // Generate embeddings
    const outputs = await this.pipeline(preparedTexts, {
      pooling: 'mean',
      normalize: true,
    });

    // Extract embeddings
    const embeddings: Float32Array[] = [];
    const dims = outputs.dims as number[];
    const dimension = dims[1] ?? EMBEDDING_DIMENSION;
    const data = outputs.data as unknown;
    const flatData = this.toFloat32Array(data);

    for (let i = 0; i < texts.length; i++) {
      const start = i * dimension;
      const end = start + dimension;
      embeddings.push(flatData.slice(start, end));
    }

    return {
      embeddings,
      dimension,
      model: this.modelId,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Convert various array formats to Float32Array
   */
  private toFloat32Array(data: unknown): Float32Array {
    if (data instanceof Float32Array) {
      return data;
    }
    if (Array.isArray(data)) {
      return new Float32Array(data);
    }
    if (data && typeof data === 'object' && 'length' in data) {
      // Handle TypedArray-like objects
      const arr = data as ArrayLike<number>;
      return Float32Array.from(Array.from(arr));
    }
    throw new Error('Unsupported data format for embedding');
  }

  /**
   * Prepare text for the nomic-embed-text model
   *
   * The model expects specific prefixes for different tasks:
   * - "search_document: " for documents to be searched
   * - "search_query: " for search queries
   */
  private prepareText(text: string, type: 'document' | 'search_query'): string {
    // Truncate very long texts (model has a max token limit)
    const maxLength = 8192; // nomic-embed-text-v1.5 supports 8192 tokens
    const truncatedText = text.length > maxLength ? text.slice(0, maxLength) : text;

    // Add appropriate prefix
    if (type === 'search_query') {
      return `search_query: ${truncatedText}`;
    } else {
      return `search_document: ${truncatedText}`;
    }
  }

  /**
   * Create text representation of a code node for embedding
   *
   * Combines name, signature, docstring, and code snippet into
   * a searchable text representation.
   */
  static createNodeText(node: {
    name: string;
    kind: string;
    qualifiedName?: string;
    signature?: string;
    docstring?: string;
    filePath: string;
  }): string {
    const parts: string[] = [];

    // Add kind and name
    parts.push(`${node.kind}: ${node.name}`);

    // Add qualified name if different from name
    if (node.qualifiedName && node.qualifiedName !== node.name) {
      parts.push(`path: ${node.qualifiedName}`);
    }

    // Add file path
    parts.push(`file: ${node.filePath}`);

    // Add signature if present
    if (node.signature) {
      parts.push(`signature: ${node.signature}`);
    }

    // Add docstring if present
    if (node.docstring) {
      parts.push(`documentation: ${node.docstring}`);
    }

    return parts.join('\n');
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i]!;
      const bVal = b[i]!;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Release resources
   */
  dispose(): void {
    this.pipeline = null;
    this.initialized = false;
  }
}

/**
 * Create a text embedder instance
 */
export function createEmbedder(options?: EmbedderOptions): TextEmbedder {
  return new TextEmbedder(options);
}
