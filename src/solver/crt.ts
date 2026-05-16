function normalize(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function crtPair(aMod2: number, aMod3: number): number {
  for (let value = 0; value < 6; value += 1) {
    if (value % 2 === normalize(aMod2, 2) && value % 3 === normalize(aMod3, 3)) {
      return value;
    }
  }

  throw new Error(`No CRT solution for (${aMod2} mod 2, ${aMod3} mod 3)`);
}

export function combineMod2Mod3(mod2Values: number[], mod3Values: number[]): number[] {
  if (mod2Values.length !== mod3Values.length) {
    throw new Error("CRT vectors must have the same length");
  }

  return mod2Values.map((value, index) => crtPair(value, mod3Values[index]));
}
