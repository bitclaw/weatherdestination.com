export type JsonPayload = Record<string, string | number | boolean | null>;

export type AuditEventRecord = {
  id: string;
  type: string;
  payload: JsonPayload | null;
  created_at: number;
};

export const EVENT_META: Record<string, { label: string; domain: string }> = {
  'api_key.created': { label: 'API Key Created', domain: 'API Keys' },
  'api_key.revoked': { label: 'API Key Revoked', domain: 'API Keys' },
  'api_key.deleted': { label: 'API Key Deleted', domain: 'API Keys' },
  'conversation.created': { label: 'Conversation Created', domain: 'Chat' },
  'conversation.deleted': { label: 'Conversation Deleted', domain: 'Chat' },
  'chat.message.saved': { label: 'Message Saved', domain: 'Chat' },
  'conversation.title.updated': {
    label: 'Conversation Renamed',
    domain: 'Chat'
  },
  'feature_request.created': {
    label: 'Feature Request Created',
    domain: 'Feature Requests'
  },
  'feature_request.updated': {
    label: 'Feature Request Updated',
    domain: 'Feature Requests'
  },
  'feature_request.deleted': {
    label: 'Feature Request Deleted',
    domain: 'Feature Requests'
  },
  'note.created': { label: 'Note Created', domain: 'Notes' },
  'note.updated': { label: 'Note Updated', domain: 'Notes' },
  'note.deleted': { label: 'Note Deleted', domain: 'Notes' },
  'note.pinned': { label: 'Note Pinned', domain: 'Notes' },
  'file.uploaded': { label: 'File Uploaded', domain: 'Files' },
  'file.deleted': { label: 'File Deleted', domain: 'Files' },
  'notification.read': { label: 'Notification Read', domain: 'Notifications' },
  'notifications.all_read': {
    label: 'All Notifications Read',
    domain: 'Notifications'
  }
};

export const eventTypeOptions = Object.entries(EVENT_META).map(
  ([value, meta]) => ({
    value,
    label: meta.label,
    domain: meta.domain
  })
);
