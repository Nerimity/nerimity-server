let emailBlacklist: string[] = [];

try {
  emailBlacklist = require('../email-blacklist.json');
} catch {
  //
}

export function isEmailBlackListed(email: string) {
  return !!emailBlacklist.find((e) => email.endsWith('@' + e));
}
