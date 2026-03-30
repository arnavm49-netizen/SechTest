import bcrypt from "bcryptjs";

export async function hash_password(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verify_password(password: string, password_hash: string) {
  return bcrypt.compare(password, password_hash);
}
