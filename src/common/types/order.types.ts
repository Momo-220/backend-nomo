// Types centralisés pour les commandes
export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  MOBILE = 'MOBILE',
  WAVE = 'WAVE',
  MYNITA = 'MYNITA'
}

export interface OrderItem {
  id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  item: {
    id: string;
    name: string;
    description?: string;
    image_url?: string;
  };
}

export interface OrderSummary {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_phone?: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  created_at: Date;
  table?: {
    id: string;
    number: string;
    name?: string;
  };
  items_count: number;
}

export interface OrderDetails extends OrderSummary {
  notes?: string;
  updated_at: Date;
  order_items: OrderItem[];
  user?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}












