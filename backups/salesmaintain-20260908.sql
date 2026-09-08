--
-- PostgreSQL database dump
--

\restrict F3rWOZsyXz8uH2saQBUaIpzRHs434JHoSObnS6rv4itbyAlJtsydKnhraJY44vi

-- Dumped from database version 18.6 (c5250a2)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_transaction_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_transaction_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  tid UUID := COALESCE(NEW.transaction_id, OLD.transaction_id);
  v_collected NUMERIC(14,2);
  v_disbursed NUMERIC(14,2);
  v_total NUMERIC(14,2);
  new_status TEXT;
BEGIN
  SELECT t.total_amount INTO v_total
  FROM transactions t WHERE t.id = tid;

  SELECT COALESCE(SUM(amount), 0) INTO v_collected
  FROM collections WHERE transaction_id = tid;

  SELECT COALESCE(SUM(amount), 0) INTO v_disbursed
  FROM disbursements WHERE transaction_id = tid;

  IF v_collected >= v_total AND v_disbursed >= v_total THEN
    new_status := 'settled';
  ELSIF v_collected = 0 AND v_disbursed = 0 THEN
    new_status := 'pending';
  ELSIF v_collected >= v_total THEN
    new_status := 'fully_collected';
  ELSIF v_disbursed > 0 THEN
    new_status := 'partially_disbursed';
  ELSIF v_collected > 0 THEN
    new_status := 'partially_collected';
  ELSE
    new_status := 'pending';
  END IF;

  UPDATE transactions SET status = new_status, updated_at = CURRENT_TIMESTAMP WHERE id = tid;
  RETURN NULL;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL,
    collected_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    payment_method text,
    note text,
    recorded_by uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    photos text[] DEFAULT '{}'::text[],
    CONSTRAINT collections_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: dealers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dealers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    address text,
    notes text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    owner_officer_id uuid NOT NULL
);


--
-- Name: disbursements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disbursements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL,
    disbursed_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    payment_method text,
    note text,
    recorded_by uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    photos text[] DEFAULT '{}'::text[],
    CONSTRAINT disbursements_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    entry_type text NOT NULL,
    reference_id uuid NOT NULL,
    dealer_id uuid,
    amount numeric(14,2) NOT NULL,
    occurred_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    recorded_by uuid NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: officers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.officers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'officer'::text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_dealer_id uuid NOT NULL,
    buyer_dealer_id uuid NOT NULL,
    officer_id uuid NOT NULL,
    product_description text,
    total_amount numeric(14,2) NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    photos text[] DEFAULT '{}'::text[],
    CONSTRAINT transactions_total_amount_check CHECK ((total_amount > (0)::numeric))
);


--
-- Name: transaction_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.transaction_summary AS
 WITH collected AS (
         SELECT collections.transaction_id,
            COALESCE(sum(collections.amount), (0)::numeric) AS total
           FROM public.collections
          GROUP BY collections.transaction_id
        ), disbursed AS (
         SELECT disbursements.transaction_id,
            COALESCE(sum(disbursements.amount), (0)::numeric) AS total
           FROM public.disbursements
          GROUP BY disbursements.transaction_id
        )
 SELECT t.id,
    t.seller_dealer_id,
    t.buyer_dealer_id,
    t.officer_id,
    t.product_description,
    t.total_amount,
    t.transaction_date,
    t.photos,
    t.created_at,
    t.updated_at,
    COALESCE(c.total, (0)::numeric) AS total_collected,
    COALESCE(d.total, (0)::numeric) AS total_disbursed,
    (COALESCE(c.total, (0)::numeric) - COALESCE(d.total, (0)::numeric)) AS officer_held_balance,
    (t.total_amount - COALESCE(c.total, (0)::numeric)) AS amount_due_from_buyer,
    (t.total_amount - COALESCE(d.total, (0)::numeric)) AS amount_due_to_seller,
        CASE
            WHEN ((COALESCE(c.total, (0)::numeric) >= t.total_amount) AND (COALESCE(d.total, (0)::numeric) >= t.total_amount)) THEN 'settled'::text
            WHEN ((COALESCE(c.total, (0)::numeric) = (0)::numeric) AND (COALESCE(d.total, (0)::numeric) = (0)::numeric)) THEN 'pending'::text
            WHEN (COALESCE(c.total, (0)::numeric) >= t.total_amount) THEN 'fully_collected'::text
            WHEN (COALESCE(d.total, (0)::numeric) > (0)::numeric) THEN 'partially_disbursed'::text
            WHEN (COALESCE(c.total, (0)::numeric) > (0)::numeric) THEN 'partially_collected'::text
            ELSE 'pending'::text
        END AS status,
    sd.name AS seller_name,
    bd.name AS buyer_name,
    o.name AS officer_name
   FROM (((((public.transactions t
     LEFT JOIN collected c ON ((c.transaction_id = t.id)))
     LEFT JOIN disbursed d ON ((d.transaction_id = t.id)))
     LEFT JOIN public.dealers sd ON ((sd.id = t.seller_dealer_id)))
     LEFT JOIN public.dealers bd ON ((bd.id = t.buyer_dealer_id)))
     LEFT JOIN public.officers o ON ((o.id = t.officer_id)));


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
b6fda7fe-20d8-4b1b-9a0b-97bbd1b10fc1	ab00277d1c533a69bdbd3ba87d5558fbb709b3ee168263b43b47446ec00c6dda	2026-09-04 18:11:00.118737+00	20260902000000_init	\N	\N	2026-09-04 18:10:59.50706+00	1
6ff50af3-3639-4a71-9b41-7275fee37620	00a68599c7b5f79cbd986dd3ca78e6aaab09d778f358b6c3173deab172c7550d	2026-09-04 18:11:00.831843+00	20260902010000_owner_scoped	\N	\N	2026-09-04 18:11:00.322648+00	1
fea01d60-ad94-466e-8586-06bb314b33ea	4de00e6e2b5e8aeaf151c9e0df169e58c728ce424d01b1ef7652c4324fceebd2	2026-09-04 18:11:01.651524+00	20260902020000_remove_commission	\N	\N	2026-09-04 18:11:01.051155+00	1
cf963758-86ed-41b4-997e-9c75dfb79863	f73a064fb95f49ebf9feaab2c304916b3e291b0389f3a80536644cdf7bb8fed2	2026-09-04 18:11:02.366948+00	20260902030000_add_photos	\N	\N	2026-09-04 18:11:01.85931+00	1
43fd529e-94e6-4780-b415-705790ba14dc	2434ca83aa2c59d675dc76b4422df60db38500071666de63c07b80251aca6449	2026-09-04 18:11:03.085448+00	20260902040000_remove_void	\N	\N	2026-09-04 18:11:02.575871+00	1
cd700c1d-9ff8-416f-a935-3e06c516f65b	8c38c64a9d4f4f519190b5fe7f17b1ca8e1c5078ad9f0d631918051e9872296a	2026-09-06 11:55:05.088517+00	20260902050000_perf_indexes	\N	\N	2026-09-06 11:55:03.866799+00	1
\.


--
-- Data for Name: collections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.collections (id, transaction_id, amount, collected_at, payment_method, note, recorded_by, created_at, photos) FROM stdin;
eb969fcc-994e-4a92-9f53-97337d65a44f	98c9f459-558c-4ba4-9f6f-fc3e02e73026	50000.00	2026-08-03 00:00:00+00	bank	First instalment	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	2026-09-04 18:12:48.641+00	{}
d222ebc7-3c30-4ccb-818d-4cb0f0ca603f	98c9f459-558c-4ba4-9f6f-fc3e02e73026	40000.00	2026-08-15 00:00:00+00	cash	Second instalment	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	2026-09-04 18:12:48.765+00	{}
b20921e1-dc37-4abf-ae53-d78068036e66	f1473def-ff1b-4c87-94fe-c9fc035d6270	48000.00	2026-08-12 00:00:00+00	mobile_banking	Full payment	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	2026-09-04 18:12:48.949+00	{}
2955d3bf-1150-45f4-8f8c-beb9891ef2b3	52de016b-2b05-45e1-a796-fe904c15117a	1000.00	2026-09-04 00:00:00+00	cash	\N	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-04 18:32:26.027+00	{}
324ad82e-c42e-4706-94a3-294af71da6eb	52de016b-2b05-45e1-a796-fe904c15117a	1000.00	2026-09-04 00:00:00+00	cash	\N	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-04 18:32:47.25+00	{}
ac0e0158-a3b5-4ae1-8da5-3ee556b180b6	52de016b-2b05-45e1-a796-fe904c15117a	1000.00	2026-09-04 00:00:00+00	cash	\N	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-04 18:32:56.978+00	{}
c52e3786-8872-4485-a0eb-01f7e2c8faa7	52de016b-2b05-45e1-a796-fe904c15117a	7000.00	2026-09-06 00:00:00+00	cash	\N	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 07:10:57.586+00	{}
1a8461e5-ffda-47ad-b16e-6a325c92ab1a	e5b391a8-68d2-4c01-89ea-05955930c84c	10000.00	2026-09-06 00:00:00+00	cash	৫০ হাজারের ভিতরে ২০০০০ নিলাম	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 16:41:31.16+00	{}
1c53b614-5c79-430e-98fe-589242e37174	e5b391a8-68d2-4c01-89ea-05955930c84c	10000.00	2026-09-06 00:00:00+00	cash	nbj	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 17:23:12.213+00	{https://res.cloudinary.com/dldimknru/image/upload/v1788715388/salesmaintain/collections/n5qa92gpp1ewsmibqjef.jpg}
\.


--
-- Data for Name: dealers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dealers (id, name, phone, address, notes, created_at, owner_officer_id) FROM stdin;
baf2f6a3-8cc6-4b41-8fd9-3a09c9c62bd1	Alauddin Agro Traders	0171-1111111	Dhaka	Rice & pulses wholesaler	2026-09-04 18:12:47.539+00	6728be72-3808-4476-aaca-21542a96ffce
81f294e2-a518-4e6f-9c25-1a1cf9c590cd	Karim General Store	0181-3333333	Chittagong	General merchant	2026-09-04 18:12:47.539+00	6728be72-3808-4476-aaca-21542a96ffce
8718d6ac-7da4-4720-94c0-cc774dd0e35d	Fertilizer Supply Co.	0191-4444444	Comilla	Fertilizer supplier	2026-09-04 18:12:47.54+00	6728be72-3808-4476-aaca-21542a96ffce
d761583e-93a1-4f1a-90de-7f32038e7988	Sobhan Rice Mills	0172-2222222	Narayanganj	Rice mill owner	2026-09-04 18:12:47.539+00	6728be72-3808-4476-aaca-21542a96ffce
2726dfa4-10fa-4b95-a989-b7ee19f6413e	B	01762534875	Natore	\N	2026-09-04 18:31:47.181+00	9195edb0-1f6a-470a-b855-d6a4a2f29298
55aeb9e2-dcf0-44f8-8169-48a96b3a23ed	A	01571007636	Singra	hello	2026-09-04 18:31:19.743+00	9195edb0-1f6a-470a-b855-d6a4a2f29298
\.


--
-- Data for Name: disbursements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.disbursements (id, transaction_id, amount, disbursed_at, payment_method, note, recorded_by, created_at, photos) FROM stdin;
c9ab3118-e3fc-4a40-8707-1770d1aec901	98c9f459-558c-4ba4-9f6f-fc3e02e73026	85000.00	2026-08-16 00:00:00+00	cash	Partial payout to seller	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	2026-09-04 18:12:48.825+00	{}
8262c237-9fb6-4912-8dd4-222a90ecbcbe	52de016b-2b05-45e1-a796-fe904c15117a	2000.00	2026-09-04 00:00:00+00	cash	\N	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-04 18:33:24.479+00	{}
8d275667-00e8-42dc-b653-83196b4b38af	52de016b-2b05-45e1-a796-fe904c15117a	8000.00	2026-09-06 00:00:00+00	bank	\N	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 07:11:21.517+00	{}
72fccfd6-a03f-4bb5-a587-ccf746660029	e5b391a8-68d2-4c01-89ea-05955930c84c	10000.00	2026-09-06 00:00:00+00	cash	 Paid 20000	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 16:42:37.738+00	{}
39b122ca-6362-43e0-86ac-08ab2bfd76b2	e5b391a8-68d2-4c01-89ea-05955930c84c	10000.00	2026-09-06 00:00:00+00	cash	\N	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 17:24:03.138+00	{}
\.


--
-- Data for Name: ledger_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ledger_entries (id, transaction_id, entry_type, reference_id, dealer_id, amount, occurred_at, recorded_by, created_at) FROM stdin;
dce73664-60a1-445c-9aab-0167a5ceb368	98c9f459-558c-4ba4-9f6f-fc3e02e73026	collection	eb969fcc-994e-4a92-9f53-97337d65a44f	baf2f6a3-8cc6-4b41-8fd9-3a09c9c62bd1	50000.00	2026-08-03 00:00:00+00	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	2026-09-04 18:12:49.01+00
69d6d075-ebbc-46b8-ae8c-f64deb4aed62	98c9f459-558c-4ba4-9f6f-fc3e02e73026	collection	d222ebc7-3c30-4ccb-818d-4cb0f0ca603f	baf2f6a3-8cc6-4b41-8fd9-3a09c9c62bd1	40000.00	2026-08-15 00:00:00+00	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	2026-09-04 18:12:49.01+00
dd7d05a9-6356-486a-b0d9-87344a84c386	98c9f459-558c-4ba4-9f6f-fc3e02e73026	disbursement	c9ab3118-e3fc-4a40-8707-1770d1aec901	d761583e-93a1-4f1a-90de-7f32038e7988	85000.00	2026-08-16 00:00:00+00	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	2026-09-04 18:12:49.01+00
ea800a9c-d971-4c01-b181-cb9a254f325d	f1473def-ff1b-4c87-94fe-c9fc035d6270	collection	b20921e1-dc37-4abf-ae53-d78068036e66	81f294e2-a518-4e6f-9c25-1a1cf9c590cd	48000.00	2026-08-12 00:00:00+00	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	2026-09-04 18:12:49.01+00
8d5f9c87-ed6f-4717-a7d9-22c9209d9c0d	52de016b-2b05-45e1-a796-fe904c15117a	collection	2955d3bf-1150-45f4-8f8c-beb9891ef2b3	2726dfa4-10fa-4b95-a989-b7ee19f6413e	1000.00	2026-09-04 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-04 18:32:26.466+00
8b9e5859-3e9a-45d4-bd49-e14f0ee29f01	52de016b-2b05-45e1-a796-fe904c15117a	collection	324ad82e-c42e-4706-94a3-294af71da6eb	2726dfa4-10fa-4b95-a989-b7ee19f6413e	1000.00	2026-09-04 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-04 18:32:47.464+00
357e545c-acfe-409a-9fc4-e9162c36c5a7	52de016b-2b05-45e1-a796-fe904c15117a	collection	ac0e0158-a3b5-4ae1-8da5-3ee556b180b6	2726dfa4-10fa-4b95-a989-b7ee19f6413e	1000.00	2026-09-04 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-04 18:32:57.431+00
6aba2495-9deb-4385-9c64-bb787d73cb55	52de016b-2b05-45e1-a796-fe904c15117a	disbursement	8262c237-9fb6-4912-8dd4-222a90ecbcbe	55aeb9e2-dcf0-44f8-8169-48a96b3a23ed	2000.00	2026-09-04 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-04 18:33:24.928+00
33382b4f-724e-4698-b729-13fc196e62cc	52de016b-2b05-45e1-a796-fe904c15117a	disbursement	8d275667-00e8-42dc-b653-83196b4b38af	55aeb9e2-dcf0-44f8-8169-48a96b3a23ed	8000.00	2026-09-06 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 07:11:21.977+00
44221a6c-7769-4d91-8f98-56bfa679ae28	52de016b-2b05-45e1-a796-fe904c15117a	collection	c52e3786-8872-4485-a0eb-01f7e2c8faa7	2726dfa4-10fa-4b95-a989-b7ee19f6413e	7000.00	2026-09-06 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 07:10:58.069+00
cd2e1354-d17f-445b-af59-f1beaabd863b	e5b391a8-68d2-4c01-89ea-05955930c84c	collection	1a8461e5-ffda-47ad-b16e-6a325c92ab1a	2726dfa4-10fa-4b95-a989-b7ee19f6413e	10000.00	2026-09-06 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 16:41:31.188+00
b6b41467-6e7a-4283-a412-05fbd9001852	e5b391a8-68d2-4c01-89ea-05955930c84c	disbursement	72fccfd6-a03f-4bb5-a587-ccf746660029	55aeb9e2-dcf0-44f8-8169-48a96b3a23ed	10000.00	2026-09-06 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 16:42:37.746+00
fe546576-6f64-4764-9fc1-40a7715db4b0	e5b391a8-68d2-4c01-89ea-05955930c84c	collection	1c53b614-5c79-430e-98fe-589242e37174	2726dfa4-10fa-4b95-a989-b7ee19f6413e	10000.00	2026-09-06 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 17:23:12.22+00
1e001c1d-efe0-4927-8583-78b8254b7ad0	e5b391a8-68d2-4c01-89ea-05955930c84c	disbursement	39b122ca-6362-43e0-86ac-08ab2bfd76b2	55aeb9e2-dcf0-44f8-8169-48a96b3a23ed	10000.00	2026-09-06 00:00:00+00	9195edb0-1f6a-470a-b855-d6a4a2f29298	2026-09-06 17:24:03.146+00
\.


--
-- Data for Name: officers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.officers (id, name, email, password_hash, role, created_at) FROM stdin;
6728be72-3808-4476-aaca-21542a96ffce	Admin	admin@salesmaintain.test	$2a$10$29nOHmxb4f.FmxcPdOCFeOJQsF4fndbQSPcKA2BpEJw.1ohSrgUaq	admin	2026-09-04 18:12:46.924+00
4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	Rahim Uddin	officer@salesmaintain.test	$2a$10$o7OU9uFDkp1Qk5JU7T/ofe1fUUEsb.9t126lIAq0SG5IyiOGOmZA.	officer	2026-09-04 18:12:47.304+00
9195edb0-1f6a-470a-b855-d6a4a2f29298	Redoy Hossen	redoyhossen9@gmail.com	$2a$10$CIVfIUPCrtZ.59PXKEUWQ.XALIkdpajVwrBz4vJjKJin0MmmWh4M.	officer	2026-09-04 18:30:10.193+00
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, seller_dealer_id, buyer_dealer_id, officer_id, product_description, total_amount, transaction_date, status, created_at, updated_at, photos) FROM stdin;
c2f011c9-ee07-4bd8-a8e6-1defdc4adb72	d761583e-93a1-4f1a-90de-7f32038e7988	81f294e2-a518-4e6f-9c25-1a1cf9c590cd	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	Puffed rice 2-ton	60000.00	2026-08-20	pending	2026-09-04 18:12:48.582+00	2026-09-04 18:12:48.582+00	{}
98c9f459-558c-4ba4-9f6f-fc3e02e73026	d761583e-93a1-4f1a-90de-7f32038e7988	baf2f6a3-8cc6-4b41-8fd9-3a09c9c62bd1	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	Basmati rice 5-ton lot	125000.00	2026-08-01	partially_disbursed	2026-09-04 18:12:48.392+00	2026-09-04 18:12:48.924209+00	{}
f1473def-ff1b-4c87-94fe-c9fc035d6270	8718d6ac-7da4-4720-94c0-cc774dd0e35d	81f294e2-a518-4e6f-9c25-1a1cf9c590cd	4b8f8f29-1713-4dcc-aee1-3f1556e53f3c	UREA fertilizer 3-ton	48000.00	2026-08-10	fully_collected	2026-09-04 18:12:48.521+00	2026-09-04 18:12:48.988756+00	{}
52de016b-2b05-45e1-a796-fe904c15117a	55aeb9e2-dcf0-44f8-8169-48a96b3a23ed	2726dfa4-10fa-4b95-a989-b7ee19f6413e	9195edb0-1f6a-470a-b855-d6a4a2f29298	seed	10000.00	2026-09-04	settled	2026-09-04 18:32:11.641+00	2026-09-06 07:13:07.662208+00	{}
e5b391a8-68d2-4c01-89ea-05955930c84c	55aeb9e2-dcf0-44f8-8169-48a96b3a23ed	2726dfa4-10fa-4b95-a989-b7ee19f6413e	9195edb0-1f6a-470a-b855-d6a4a2f29298	হাই সুপার গোল্ড 	50000.00	2026-09-06	partially_disbursed	2026-09-06 16:40:04.828+00	2026-09-06 17:28:03.05+00	{https://res.cloudinary.com/dldimknru/image/upload/v1788712798/salesmaintain/transactions/e2jmjukysddplcmgncsr.jpg}
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: dealers dealers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_pkey PRIMARY KEY (id);


--
-- Name: disbursements disbursements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disbursements
    ADD CONSTRAINT disbursements_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: officers officers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.officers
    ADD CONSTRAINT officers_email_key UNIQUE (email);


--
-- Name: officers officers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.officers
    ADD CONSTRAINT officers_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: idx_collections_txn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_txn ON public.collections USING btree (transaction_id);


--
-- Name: idx_dealers_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dealers_owner ON public.dealers USING btree (owner_officer_id);


--
-- Name: idx_disbursements_txn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disbursements_txn ON public.disbursements USING btree (transaction_id);


--
-- Name: idx_ledger_dealer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_dealer ON public.ledger_entries USING btree (dealer_id);


--
-- Name: idx_ledger_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_occurred ON public.ledger_entries USING btree (occurred_at);


--
-- Name: idx_ledger_txn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ledger_txn ON public.ledger_entries USING btree (transaction_id);


--
-- Name: idx_transactions_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_buyer ON public.transactions USING btree (buyer_dealer_id);


--
-- Name: idx_transactions_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_seller ON public.transactions USING btree (seller_dealer_id);


--
-- Name: transactions_officer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_officer_id_idx ON public.transactions USING btree (officer_id);


--
-- Name: collections trg_transaction_status_collections; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_transaction_status_collections AFTER INSERT OR UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.update_transaction_status();


--
-- Name: disbursements trg_transaction_status_disbursements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_transaction_status_disbursements AFTER INSERT OR UPDATE ON public.disbursements FOR EACH ROW EXECUTE FUNCTION public.update_transaction_status();


--
-- Name: collections collections_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.officers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: collections collections_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dealers dealers_owner_officer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealers
    ADD CONSTRAINT dealers_owner_officer_id_fkey FOREIGN KEY (owner_officer_id) REFERENCES public.officers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: disbursements disbursements_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disbursements
    ADD CONSTRAINT disbursements_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.officers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: disbursements disbursements_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disbursements
    ADD CONSTRAINT disbursements_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ledger_entries ledger_entries_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.officers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ledger_entries ledger_entries_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_buyer_dealer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_buyer_dealer_id_fkey FOREIGN KEY (buyer_dealer_id) REFERENCES public.dealers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_officer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_officer_id_fkey FOREIGN KEY (officer_id) REFERENCES public.officers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_seller_dealer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_seller_dealer_id_fkey FOREIGN KEY (seller_dealer_id) REFERENCES public.dealers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict F3rWOZsyXz8uH2saQBUaIpzRHs434JHoSObnS6rv4itbyAlJtsydKnhraJY44vi

