import { Bitwise, ROLE_PERMISSIONS, hasBit } from './Bitwise';

interface serverMemberHasPermissionOpts {
  permission: Bitwise;
  member: { roleIds: string[] };
  serverRoles: { permissions: number; id: string }[];
  ignoreAdmin?: boolean;
  defaultRoleId: string;
}

export const serverMemberHasPermission = (opts: serverMemberHasPermissionOpts) => {
  const memberRoles = opts.member.roleIds.map((id) => opts.serverRoles.find((role) => role.id === id));

  const defaultRole = opts.serverRoles.find((role) => role.id === opts.defaultRoleId);
  if (defaultRole) memberRoles.push(defaultRole);

  for (let i = 0; i < memberRoles.length; i++) {
    const role = memberRoles[i];
    if (!role) continue;
    if (!opts.ignoreAdmin) {
      if (hasBit(role.permissions, ROLE_PERMISSIONS.ADMIN.bit)) return true;
    }
    const hasPerm = hasBit(role.permissions, opts.permission.bit);
    if (hasPerm) return true;
  }
  return false;
};
