async function hash(password: string, rounds) {
  const hash = await Bun.password.hash(password, { cost: rounds, algorithm: 'bcrypt' });
  return hash;
}

async function compare(password: string, hash: string) {
  const isValid = await Bun.password.verify(password, hash);
  return isValid;
}

export default { hash, compare };
