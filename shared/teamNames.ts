// Random team names for people who'd rather not think of one.

const CLASSICS = [
  "Bottle Rockets",
  "Disc Jockeys",
  "Cork Dorks",
  "Toss Bosses",
  "Glass Half Full",
  "Pole Position",
  "Neck & Neck",
  "The Clinkers",
  "Spin Doctors",
  "Bottle Service",
  "Frisbae",
  "Tipsy Turvy",
  "Lawn Rangers",
  "Hurl Scouts",
  "Clink Floyd",
  "Toss Angeles",
  "Flying Saucers",
  "Bottle Royale",
  "Disc-functional",
  "The Topplers",
  "Knock on Wood",
  "Spill Seekers",
  "Saucer Sorcerers",
  "Plastic Fantastic",
  "Wobble Gobblers",
  "Fizz Kids",
];

const ADJECTIVES = [
  "Tipsy",
  "Wobbly",
  "Rowdy",
  "Sloppy",
  "Dizzy",
  "Thirsty",
  "Sunburnt",
  "Sneaky",
  "Feral",
  "Fizzy",
  "Bubbly",
  "Chaotic",
  "Unbothered",
  "Lucky",
  "Spicy",
  "Clumsy",
  "Majestic",
  "Caffeinated",
];

const NOUNS = [
  "Bottles",
  "Frisbees",
  "Corks",
  "Wobblers",
  "Topplers",
  "Saucers",
  "Spinners",
  "Lawn Gnomes",
  "Flamingos",
  "Possums",
  "Raccoons",
  "Geese",
  "Goblins",
  "Gremlins",
  "Pigeons",
  "Otters",
];

export function funnyTeamName(random: () => number = Math.random): string {
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  if (random() < 0.35) return pick(CLASSICS);
  return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

/** A random name that isn't in `taken` (case-insensitive), numbered if we somehow run out. */
export function uniqueFunnyTeamName(taken: Iterable<string>, random: () => number = Math.random): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  for (let i = 0; i < 50; i++) {
    const name = funnyTeamName(random);
    if (!used.has(name.toLowerCase())) return name;
  }
  const base = funnyTeamName(random);
  let n = 2;
  while (used.has(`${base} ${n}`.toLowerCase())) n++;
  return `${base} ${n}`;
}
