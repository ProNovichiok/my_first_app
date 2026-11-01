export const schema=`
CREATE SCHEMA IF NOT EXISTS baltic_v4;
CREATE TABLE IF NOT EXISTS baltic_v4.bookings(
 id text PRIMARY KEY,car text NOT NULL,start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,
 days integer NOT NULL CHECK(days>0),total integer NOT NULL CHECK(total>=0),deposit integer NOT NULL CHECK(deposit>=0),
 status text NOT NULL CHECK(status IN ('hold','pending','confirmed','active','completed','cancelled','expired')),
 expires bigint NOT NULL,created bigint NOT NULL,claim_hash text UNIQUE,chat_hash text,chat_enc text,pii text,consent jsonb,terms jsonb NOT NULL,
 closed bigint,paid integer NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=total),CHECK(end_at>start_at));
CREATE INDEX IF NOT EXISTS bookings_car_dates_v4 ON baltic_v4.bookings(car,start_at,end_at);
CREATE INDEX IF NOT EXISTS bookings_chat_v4 ON baltic_v4.bookings(chat_hash);
CREATE TABLE IF NOT EXISTS baltic_v4.audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,at bigint NOT NULL,booking text,event text NOT NULL);
CREATE TABLE IF NOT EXISTS baltic_v4.telegram_updates(update_id bigint PRIMARY KEY,created bigint NOT NULL);
CREATE TABLE IF NOT EXISTS baltic_v4.rate_limits(key text PRIMARY KEY,expires bigint NOT NULL,hits integer NOT NULL);
CREATE TABLE IF NOT EXISTS baltic_v4.outbox(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,update_id bigint UNIQUE,payload text NOT NULL,sent boolean NOT NULL DEFAULT false,locked_until bigint NOT NULL DEFAULT 0,created bigint NOT NULL);
`;
