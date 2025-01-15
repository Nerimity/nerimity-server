export const ModAuditLogType = {
  userSuspend: 0,
  userUnsuspend: 1,
  userUpdate: 2,
  serverDelete: 3,
  serverUpdate: 4,
  postDelete: 5,
  userSuspendUpdate: 6,
  userWarned: 7,
  ipBan: 8,
  serverDeleteUndo: 9,
} as const;
