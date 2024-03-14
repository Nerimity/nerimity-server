import { Bitwise, ROLE_PERMISSIONS, hasBit } from './Bitwise';

export const serverMemberHasPermission = (permission: Bitwise, member: { roleIds: string[] }, serverRoles: { permissions: number; id: string }[], ignoreAdmin = false) => {
  const memberRoles = member.roleIds.map((id) => serverRoles.find((role) => role.id === id));

  for (let i = 0; i < memberRoles.length; i++) {
    const role = memberRoles[i];
    if (!role) continue;
    if (!ignoreAdmin) {
      if (hasBit(role.permissions, ROLE_PERMISSIONS.ADMIN.bit)) return true;
    }
    const hasPerm = hasBit(role.permissions, permission.bit);
    if (hasPerm) return true;
  }
  return false;
};
