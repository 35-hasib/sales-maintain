export type Summary = {
  id: string;
  seller_dealer_id: string;
  buyer_dealer_id: string;
  officer_id: string;
  product_description: string | null;
  total_amount: string;
  transaction_date: string;
  total_collected: string;
  total_disbursed: string;
  officer_held_balance: string;
  amount_due_from_buyer: string;
  amount_due_to_seller: string;
  status: string;
  photos?: string[];
  seller_name?: string | null;
  buyer_name?: string | null;
};

export type Dealer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  _count?: { transactionsAsSeller: number; transactionsAsBuyer: number };
};

export type LedgerEntry = {
  id: string;
  transaction_id: string;
  entry_type: string;
  reference_id: string;
  dealer_id: string | null;
  amount: string;
  occurred_at: string;
  recorded_by: string;
  officer_name?: string;
  dealer_name?: string | null;
  note?: string | null;
};

export type Officer = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
};
