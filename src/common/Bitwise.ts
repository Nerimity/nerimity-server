export interface Bitwise {
  name: string;
  description?: string;
  bit: number;
  icon?: string;
  free?: boolean;
}

export const USER_BADGES = {
  FOUNDER: {
    name: 'Founder',
    bit: 1,
    description: 'Creator of Nerimity',
    color: '#6fd894',
  },
  ADMIN: {
    name: 'Admin',
    bit: 2,
    description: 'Admin of Nerimity',
    color: '#d8a66f',
  },
  CONTRIBUTOR: {
    name: 'Contributor',
    description: 'Helped with this project in some way',
    bit: 4,
    color: '#ffffff',
  },
  SUPPORTER: {
    name: 'Supporter',
    description: 'Supported this project by donating money',
    bit: 8,
    color: '#d86f6f',
  },
  EMO_SUPPORTER: {
    name: 'Emo Supporter',
    description: 'Supported this project by donating money',
    bit: 128,
  },
  PALESTINE: {
    free: true,
    name: 'Palestine',
    description: 'Palestine',
    bit: 16,
    color: 'linear-gradient(90deg, rgba(224,26,185,1) 0%, rgba(64,122,255,1) 100%);',
  },
  MOD: {
    name: 'Moderator',
    description: 'Moderator of Nerimity',
    bit: 64,
    credit: 'Avatar Border by upklyak on Freepik',
  },
};

export const isUserAdmin = (badge: number) => {
  return hasBit(badge, USER_BADGES.ADMIN.bit) || hasBit(badge, USER_BADGES.FOUNDER.bit);
};

export const CHANNEL_PERMISSIONS = {
  PUBLIC_CHANNEL: {
    name: 'Public Channel',
    description: 'Enable access to the channel. Server admins can access any channel.',
    bit: 1,
    icon: 'public',
  },
  SEND_MESSAGE: {
    name: 'Send Message',
    description: 'Enable sending messages in the channel. Server admins can still send messages.',
    bit: 2,
    icon: 'mail',
  },
  JOIN_VOICE: {
    name: 'Join Voice',
    description: 'Enable joining voice channels in the channel. Server admins can still join voice channels.',
    bit: 4,
    icon: 'call',
  },
};

export const ROLE_PERMISSIONS = {
  ADMIN: {
    name: 'Admin',
    description: 'Enables all permissions.',
    bit: 1,
    // icon: 'mail'
  },
  SEND_MESSAGE: {
    name: 'Send Message',
    description: 'Enable sending messages in this server. Server admins can still send messages.',
    bit: 2,
    icon: 'mail',
  },
  MANAGE_ROLES: {
    name: 'Manage Roles',
    description: 'Permission for updating or deleting roles.',
    // icon: 'mail',
    bit: 4,
  },
  MANAGE_CHANNELS: {
    name: 'Manage Channels',
    description: 'Permission for updating or deleting channels.',
    // icon: 'mail',
    bit: 8,
  },
  KICK: {
    name: 'Kick',
    description: 'Permission to kick users',
    bit: 16,
    // icon: 'mail'
  },
  BAN: {
    name: 'Ban',
    description: 'Permission to ban users.',
    bit: 32,
    // icon: 'mail'
  },
  MENTION_EVERYONE: {
    name: 'Mention Everyone',
    description: 'mentionEveryoneDescription',
    bit: 64,
  },
  NICKNAME_MEMBER: {
    name: 'Nickname Member',
    description: 'mentionEveryoneDescription',
    bit: 128,
  },
  MENTION_ROLES: {
    name: 'Mention Roles',
    bit: 256,
  },
};

export const hasBit = (permissions: number, bit: number) => {
  return (permissions & bit) === bit;
};

export const addBit = (permissions: number, bit: number) => {
  return permissions | bit;
};

export const removeBit = (permissions: number, bit: number) => {
  return permissions & ~bit;
};

export const getAllPermissions = (permissionList: Record<string, Bitwise>, permissions: number) => {
  return Object.values(permissionList).map((permission) => {
    const hasPerm = hasBit(permissions, permission.bit);
    return {
      ...permission,
      hasPerm,
    };
  });
};
