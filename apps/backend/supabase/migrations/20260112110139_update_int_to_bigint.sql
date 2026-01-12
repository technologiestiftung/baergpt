-- Update token counters to bigint to prevent overflow
ALTER TABLE profiles ALTER COLUMN num_inference_tokens TYPE bigint;
ALTER TABLE profiles ALTER COLUMN num_embedding_tokens TYPE bigint;

