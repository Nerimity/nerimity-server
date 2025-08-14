const PREFIX = 'NERIMITY_';

// WS KEYS
export const CONNECTED_SOCKET_ID_KEY_SET = (userId: string) => `${PREFIX}SOCKET_USER_CONNECTED:${userId}` as const;
export const CONNECTED_USER_ID_KEY_STRING = (socketId: string) => `${PREFIX}SOCKET_USER_ID:${socketId}` as const;

export const VOICE_USERS_KEY_HASH = (channelId: string) => `${PREFIX}VOICE_USERS:${channelId}` as const;
export const VOICE_USER_CHANNEL_ID_SET = (userId: string) => `${PREFIX}VOICE_USER_CHANNEL_ID:${userId}` as const;
export const USER_PRESENCE_KEY_STRING = (userId: string) => `${PREFIX}USER_PRESENCE:${userId}` as const;

export const WS_KEYS = ['socket.io', CONNECTED_SOCKET_ID_KEY_SET(''), CONNECTED_USER_ID_KEY_STRING(''), VOICE_USERS_KEY_HASH(''), VOICE_USER_CHANNEL_ID_SET(''), USER_PRESENCE_KEY_STRING('')] as const;

// API KEYS

export const USER_CACHE_KEY_STRING = (userId: string) => `${PREFIX}USER:${userId}` as const;

export const WEBHOOK_CACHE_KEY_STRING = (id: string) => `${PREFIX}WEBHOOK:${id}` as const;

export const GOOGLE_ACCESS_TOKEN = (userId: string) => `${PREFIX}GOOGLE_ACCESS_TOKEN:${userId}` as const;

export const SERVER_KEY_STRING = (serverId: string) => `${PREFIX}SERVER:${serverId}` as const;

export const SERVER_CHANNEL_PERMISSION_KEY_HASH = (channelId: string) => `${PREFIX}SERVER_CHANNEL_PERMISSION:${channelId}` as const;

export const SERVER_CHANNEL_KEY_STRING = (channelId: string) => `${PREFIX}SERVER_CHANNEL:${channelId}` as const;
export const DM_CHANNEL_KEY_STRING = (channelId: string) => `${PREFIX}DM_CHANNEL:${channelId}` as const;
export const TICKET_CHANNEL_KEY_STRING = (channelId: string) => `${PREFIX}TICKET_CHANNEL:${channelId}` as const;
export const INBOX_KEY_STRING = (channelId: string, userId: string) => `${PREFIX}INBOX:${userId}:${channelId}` as const;

export const SERVER_MEMBERS_KEY_HASH = (serverId: string) => `${PREFIX}SERVER_MEMBERS:${serverId}` as const;

export const RATE_LIMIT_KEY_STRING = (id: string) => `${PREFIX}RATE_LIMIT:${id}` as const;

// tracks how many times the user has been rate limited in 3 minutes.
export const RATE_LIMIT_ITTER_KEY_STRING = (id: string) => `${PREFIX}RATE_LIMIT_ITTER:${id}` as const;

export const ALLOWED_IP_KEY_SET = () => `${PREFIX}ALLOWED_IP` as const;

export const POST_VIEWS_KEY = (postId: string) => `${PREFIX}POST_VIEWS:${postId}`;
