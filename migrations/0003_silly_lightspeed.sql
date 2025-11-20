CREATE TABLE "invoice_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_card_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"invoice_month" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"due_date" date NOT NULL,
	"transaction_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "credit_cards" ADD COLUMN "closing_day" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurrence_frequency" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurrence_end_date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "launch_type" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurrence_group_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cards" DROP COLUMN "last_four_digits";