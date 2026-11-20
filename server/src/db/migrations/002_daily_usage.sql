CREATE TABLE daily_analysis_usage (
 user_id text NOT NULL, usage_date date NOT NULL, analyses_started integer NOT NULL DEFAULT 0 CHECK (analyses_started >= 0),
 PRIMARY KEY (user_id, usage_date)
);
