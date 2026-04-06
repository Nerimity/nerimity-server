export interface Bitwise {
  name: string;
  description?: string;
  bit: number;
  icon?: string;
  free?: boolean;
}

export const USER_BADGES = {
  DEER_EARS_WHITE: {
    bit: 8388608,
    color: 'linear-gradient(273deg, #fb83a7, #ffffff)',
    textColor: '#2a1d1d',
    overlay: true,
    icon: 'pets',
  },
  DEER_EARS_HORNS_DARK: {
    bit: 1048576,
    color: 'linear-gradient(267deg, #8f8f8f, #090a25)',
    textColor: '#ffffff',
    overlay: true,
    icon: 'pets',
  },
  DEER_EARS_HORNS: {
    bit: 262144,
    color: 'linear-gradient(270deg, #aa4908, #ffd894)',
    textColor: '#321515',
    overlay: true,
    icon: 'pets',
  },
  GOAT_HORNS: {
    bit: 524288,
    color: 'linear-gradient(268deg, #cb75d7, #390a8f)',
    overlay: true,
    icon: 'pets',
  },
  GOAT_EARS_WHITE: {
    bit: 131072,
    color: 'linear-gradient(89deg, #ffecc2, #94e4ff)',
    textColor: '#503030',
    overlay: true,
    icon: 'pets',
  },
  WOLF_EARS: {
    bit: 65536,
    color: 'linear-gradient(90deg, #585858ff 0%, #252525ff 100%)',
    textColor: '#ffffff',
    overlay: true,
    icon: 'pets',
  },
  DOG_SHIBA: {
    bit: 32768,
    color: 'linear-gradient(261deg, #ffeeb3, #9e7aff)',
    textColor: '#2e1919',
    overlay: true,
    icon: 'sound_detection_dog_barking',
  },
  DOG_EARS_BROWN: {
    bit: 16384,
    color: 'linear-gradient(90deg, #bb7435 0%, #ffbd67ff 100%)',
    overlay: true,
    icon: 'sound_detection_dog_barking',
  },
  BUNNY_EARS_MAID: {
    bit: 8192,
    color: 'linear-gradient(100deg, #ff94e2, #ffffff)',
    textColor: '#2a1d1d',
    overlay: true,
    icon: 'cruelty_free',
  },
  BUNNY_EARS_BLACK: {
    bit: 4096,
    color: 'linear-gradient(90deg, #585858ff 0%, #252525ff 100%)',
    textColor: '#ffffff',
    overlay: true,
    icon: 'cruelty_free',
  },
  CAT_EARS_MAID: {
    bit: 2097152,
    color: 'linear-gradient(100deg, #ff94e2, #ffffff)',
    textColor: '#2a1d1d',
    overlay: true,
    icon: 'pets',
  },
  CAT_EARS_PURPLE: {
    bit: 4194304,
    color: 'linear-gradient(268deg, #cb75d7, #390a8f)',
    textColor: '#ffffff',
    overlay: true,
    icon: 'pets',
  },
  CAT_EARS_BLUE: {
    bit: 512,
    color: 'linear-gradient(90deg, #78a5ff 0%, #ffffff 100%)',
    overlay: true,
    icon: 'pets',
  },
  CAT_EARS_WHITE: {
    bit: 256,
    color: 'linear-gradient(90deg, #ffa761 0%, #ffffff 100%)',
    overlay: true,
    icon: 'pets',
  },
  FOX_EARS_GOLD: {
    bit: 1024,
    color: 'linear-gradient(90deg, #ffb100 0%, #ffffff 100%)',
    overlay: true,
    icon: 'pets',
  },
  FOX_EARS_BROWN: {
    bit: 2048,
    color: 'linear-gradient(90deg, #bb7435 0%, #ffffff 100%)',
    overlay: true,
    icon: 'pets',
  },
  FOUNDER: {
    removable: false,
    bit: 1,
    color: 'linear-gradient(90deg, #4fffbd 0%, #4a5efc 100%)',
    type: 'earned',
    icon: 'crown',
  },
  ADMIN: {
    removable: false,
    bit: 2,
    color: 'linear-gradient(90deg, rgba(224,26,185,1) 0%, rgba(64,122,255,1) 100%)',
    type: 'earned',
    icon: 'verified_user',
  },
  MOD: {
    removable: false,
    bit: 64,
    color: 'linear-gradient(90deg, #57acfa 0%, #1485ed 100%)',
    type: 'earned',
    icon: 'shield',
  },
  EMO_SUPPORTER: {
    bit: 128,
    textColor: 'rgba(255,255,255,0.8)',
    color: 'linear-gradient(90deg, #424242 0%, #303030 100%)',
    type: 'earned',
    icon: 'favorite',
  },
  SUPPORTER: {
    bit: 8,
    color: 'linear-gradient(90deg, rgba(235,78,209,1) 0%, rgba(243,189,247,1) 100%)',
    type: 'earned',
    icon: 'favorite',
  },
  CONTRIBUTOR: {
    bit: 4,
    color: '#ffffff',
    type: 'earned',
    icon: 'crowdsource',
  },
  PALESTINE: {
    bit: 16,
    color: 'linear-gradient(90deg, red, white, green)',
    icon: 'volunteer_activism',
  },
  BOT: {
    removable: false,
    bit: 32,
    color: 'var(--primary-color)',
    type: 'earned',
    icon: 'robot_2',
  },
};

export const UserBadgesArray = Object.values(USER_BADGES);

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
    bit: 1 << 0,
    // icon: 'mail'
  },
  SEND_MESSAGE: {
    name: 'Send Message',
    description: 'Enable sending messages in this server. Server admins can still send messages.',
    bit: 1 << 1,
    icon: 'mail',
  },
  MANAGE_ROLES: {
    name: 'Manage Roles',
    description: 'Permission for updating or deleting roles.',
    // icon: 'mail',
    bit: 1 << 2,
  },
  MANAGE_CHANNELS: {
    name: 'Manage Channels',
    description: 'Permission for updating or deleting channels.',
    // icon: 'mail',
    bit: 1 << 3,
  },
  KICK: {
    name: 'Kick',
    description: 'Permission to kick users',
    bit: 1 << 4,
    // icon: 'mail'
  },
  BAN: {
    name: 'Ban',
    description: 'Permission to ban users.',
    bit: 1 << 5,
    // icon: 'mail'
  },
  MENTION_EVERYONE: {
    name: 'Mention Everyone',
    description: 'mentionEveryoneDescription',
    bit: 1 << 6,
  },
  NICKNAME_MEMBER: {
    name: 'Nickname Member',
    description: 'mentionEveryoneDescription',
    bit: 1 << 7,
  },
  MENTION_ROLES: {
    name: 'Mention Roles',
    bit: 1 << 8,
  },
};

export const APPLICATION_SCOPES = {
  USER_INFO: {
    name: 'User Info',
    bit: 1,
  },
  USER_EMAIL: {
    name: 'User Email',
    bit: 2,
  },
  USER_SERVERS: {
    name: 'User Servers',
    bit: 4,
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
