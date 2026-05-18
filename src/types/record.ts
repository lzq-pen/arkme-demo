export type RecordSourceConversationType = "ai" | "self" | "test";

export type RecordSourceConversation = {
  type: RecordSourceConversationType;
  label: string;
  actionLabel: string;
  iconLabel: string;
  entryIndex?: number;
  recordUid?: string;
  identityId?: string;
  conversationId?: string;
};

export type RecordReference = {
  uid: string;
  text_content: string;
  send_at: number;
  create_at: number;
  update_at: number;
  sourceConversation?: RecordSourceConversation;
};

export type RecordItem = {
  uid: string;
  text_content: string;
  send_at: number;
  create_at: number;
  update_at: number;
  sourceConversation?: RecordSourceConversation;
  referencedRecord?: RecordReference;
};
