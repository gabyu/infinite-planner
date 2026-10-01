import "server-only"
import { randomInt } from "node:crypto"

// Unambiguous characters only (no 0/O, 1/l/I): the password is relayed by hand.
// Symbols are limited to ones that don't trigger chat markdown (* _ ~ ` # >).
const LOWER = "abcdefghijkmnopqrstuvwxyz"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const SYMBOLS = "-+=?"

const pick = (set: string) => set[randomInt(set.length)]

// 24 characters, at least one of each class, drawn with a CSPRNG (node:crypto).
export function generateTemporaryPassword(length = 24) {
  const all = LOWER + UPPER + DIGITS + SYMBOLS
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < length) chars.push(pick(all))

  // Fisher-Yates shuffle with the same CSPRNG.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  // Never start with a symbol ("-" or "+" at the start of a line is formatting in chat apps).
  if (SYMBOLS.includes(chars[0])) {
    const swapWith = chars.findIndex((c) => !SYMBOLS.includes(c))
    ;[chars[0], chars[swapWith]] = [chars[swapWith], chars[0]]
  }

  return chars.join("")
}
