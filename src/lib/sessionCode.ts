const WORDS = [
  "amber", "apple", "apricot", "aqua", "archer", "atlas", "autumn", "avocado",
  "bamboo", "banjo", "basil", "beacon", "bear", "beetle", "berry", "birch",
  "bison", "blossom", "blaze", "breeze", "brick", "brook", "bumble", "bunny",
  "cactus", "calm", "camel", "canyon", "caramel", "cedar", "cherry", "chestnut",
  "cinder", "citrus", "clay", "cliff", "cloud", "clover", "cobalt", "comet",
  "copper", "coral", "cosmos", "cranberry", "crescent", "cricket", "crimson", "crystal",
  "cypress", "daffodil", "daisy", "dandelion", "dawn", "deer", "delta", "dolphin",
  "dove", "dragonfly", "drift", "dune", "dusk", "eagle", "echo", "elm",
  "ember", "falcon", "fern", "fig", "finch", "fir", "flame", "flamingo",
  "flint", "flora", "forest", "fossil", "fox", "frost", "galaxy", "garden",
  "garnet", "gecko", "gem", "glacier", "glimmer", "gnome", "golden", "gopher",
  "granite", "grape", "grass", "grove", "harbor", "harvest", "hawk", "hazel",
  "hedgehog", "heron", "hickory", "honey", "horizon", "hummingbird", "iceberg", "indigo",
  "iris", "ivy", "jade", "jaguar", "jasper", "jasmine", "juniper", "kelp",
  "kestrel", "kiwi", "lagoon", "lantern", "lark", "laurel", "lava", "lavender",
  "lemon", "lilac", "lily", "lime", "linen", "lobster", "lotus", "lunar",
  "lynx", "magma", "magnolia", "maple", "marble", "marigold", "marina", "meadow",
  "meerkat", "meteor", "mint", "mirage", "mist", "mocha", "moon", "moss",
  "mountain", "mulberry", "nectar", "night", "nova", "oasis", "ocean", "olive",
  "onyx", "opal", "orbit", "orchid", "osprey", "otter", "owl", "oyster",
  "panda", "papaya", "peach", "pearl", "pebble", "pelican", "pepper", "petal",
  "phoenix", "pine", "pioneer", "planet", "plum", "polar", "poppy", "prairie",
  "pumpkin", "quail", "quartz", "quill", "rabbit", "raccoon", "rainbow", "raven",
  "reef", "river", "robin", "rocket", "rose", "ruby", "saffron", "sage",
  "salmon", "sand", "sapphire", "seal", "sequoia", "shadow", "shale", "shell",
  "silver", "sky", "slate", "snow", "solar", "sparrow", "spruce", "star",
  "stone", "storm", "strawberry", "summer", "sun", "sunrise", "sunset", "swan",
  "tangerine", "teal", "terra", "thistle", "thunder", "tiger", "timber", "topaz",
  "trail", "tulip", "tundra", "turtle", "twilight", "umber", "valley", "violet",
  "volcano", "walnut", "walrus", "wave", "willow", "wind", "winter", "wolf",
  "wombat", "woodland", "zephyr", "zinc",
] as const;

const WORD_COUNT = WORDS.length;

export function generateSessionCode(random: () => number = Math.random): string {
  const pick = () => WORDS[Math.floor(random() * WORD_COUNT)];
  return `${pick()}-${pick()}-${pick()}`;
}

export function isValidSessionCode(code: string): boolean {
  return /^[a-z]+(-[a-z]+){2}$/.test(code);
}

export { WORDS };
