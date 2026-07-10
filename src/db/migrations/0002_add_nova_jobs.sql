CREATE TABLE IF NOT EXISTS "nova_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scope_customer_id" text REFERENCES "customers"("id") ON DELETE SET NULL,
  "input_filename" text,
  "input_mime_type" text,
  "input_storage_key" text,
  "status" text DEFAULT 'queued' NOT NULL,
  "stage" text DEFAULT 'Queued' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "response" jsonb,
  "error" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "cancel_requested" boolean DEFAULT false NOT NULL,
  "lease_expires_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "nova_jobs_queue_idx"
  ON "nova_jobs" ("status", "created_at");
