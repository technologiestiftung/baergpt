-- Update token counters to bigint to prevent overflow
ALTER TABLE profiles
ALTER COLUMN num_inference_tokens type BIGINT;

ALTER TABLE profiles
ALTER COLUMN num_embedding_tokens type BIGINT;
